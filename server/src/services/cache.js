/**
 * Unified Redis Cache Service — Upstash Edition
 *
 * Wraps the @upstash/redis client with a clean cache-aside interface.
 * Key API differences vs. node-redis that are handled here:
 *
 *   node-redis                          @upstash/redis
 *   ─────────────────────────────────── ──────────────────────────────────────
 *   client.get(k) → raw JSON string     redis.get(k) → already-parsed value
 *   client.setEx(k, ttl, JSON.str)      redis.set(k, value, { ex: ttl })
 *   client.del([k1, k2])                redis.del(k1, k2)   (spread)
 *   scan returns { cursor, keys }       scan returns [cursor, keys]
 *   EventEmitter 'ready'/'error'        HTTP — no events, try/catch only
 */
import { redis } from '../lib/redis.js';

// ── Graceful Degradation & Self-Healing ───────────────────────────────────────
// Track whether Upstash is reachable. On first successful operation, flips to
// true. On any error, flips back to false and records the timestamp to enters a cooldown.
let redisAvailable = false;
let lastRedisErrorTime = 0;
const COOLDOWN_MS = 15000; // 15 seconds cooldown before retrying Redis

function shouldAttemptRedis() {
    if (redisAvailable) return true;
    if (Date.now() - lastRedisErrorTime > COOLDOWN_MS) {
        return true;
    }
    return false;
}

function handleRedisSuccess() {
    redisAvailable = true;
}

function handleRedisError(err) {
    if (redisAvailable) {
        console.error('[Cache] Upstash connection lost (entering cooldown):', err.message);
    }
    redisAvailable = false;
    lastRedisErrorTime = Date.now();
}

// Warm-up: try a quick PING to set initial availability state.
// This runs once at module load — non-blocking.
redis.ping().then(() => {
    handleRedisSuccess();
    console.log('[Cache] Upstash ready');
}).catch((err) => {
    handleRedisError(err);
    console.error('[Cache] Upstash unavailable on startup:', err.message);
});

// ── Primitives ────────────────────────────────────────────────────────────────

// Simple L1 cache (in-process memory)
const l1Cache = new Map();

function l1Get(key) {
    const entry = l1Cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        l1Cache.delete(key);
        return null;
    }
    return entry.value;
}

function l1Set(key, value, ttlSeconds) {
    l1Cache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}

function l1Delete(key) {
    l1Cache.delete(key);
}

function l1DeletePattern(pattern) {
    // Convert glob-like pattern to regex (e.g. 'v1:reports:*:*' -> /^v1:reports:.*:.*$/)
    const regexStr = '^' + pattern
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, (ch) => (ch === '*' ? '.*' : '\\' + ch)) + '$';
    const regex = new RegExp(regexStr);
    for (const key of l1Cache.keys()) {
        if (regex.test(key)) {
            l1Cache.delete(key);
        }
    }
}

/**
 * Get a cached value.
 * @upstash/redis already deserializes JSON — returns the parsed value directly.
 * Returns null on cache miss or if Redis is unavailable.
 */
export async function cacheGet(key) {
    // Check L1 Cache first
    const l1Hit = l1Get(key);
    if (l1Hit !== null) {
        return l1Hit;
    }

    if (!shouldAttemptRedis()) return null;
    try {
        const value = await redis.get(key);
        handleRedisSuccess();
        if (value !== null && value !== undefined) {
            // Populate L1 cache (using default of 5 minutes TTL for L1)
            l1Set(key, value, 300);
        }
        return value ?? null;
    } catch (err) {
        handleRedisError(err);
        return null;
    }
}

/**
 * Store a value with a TTL (seconds).
 * @upstash/redis auto-serializes the value to JSON.
 */
export async function cacheSet(key, value, ttlSeconds) {
    // Set in L1 first
    l1Set(key, value, ttlSeconds);

    if (!shouldAttemptRedis()) return;
    try {
        await redis.set(key, value, { ex: ttlSeconds });
        handleRedisSuccess();
    } catch (err) {
        handleRedisError(err);
        console.error('[Cache] set failed:', err.message);
    }
}

/**
 * Delete one or more specific keys.
 */
export async function cacheDelete(...keys) {
    for (const key of keys) {
        l1Delete(key);
    }
    if (keys.length === 0 || !shouldAttemptRedis()) return;
    try {
        // @upstash/redis del accepts spread args: del(k1, k2, k3)
        await redis.del(...keys);
        handleRedisSuccess();
    } catch (err) {
        handleRedisError(err);
        console.error('[Cache] del failed:', err.message);
    }
}

/**
 * Delete all keys matching a glob pattern (SCAN-based, non-blocking).
 * @upstash/redis scan returns [nextCursor, keys] (array, not object).
 */
export async function cacheDeletePattern(pattern) {
    l1DeletePattern(pattern);
    if (!shouldAttemptRedis()) return;
    try {
        let cursor = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 200 });
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== 0 && cursor !== '0');
        handleRedisSuccess();
    } catch (err) {
        handleRedisError(err);
        console.error('[Cache] deletePattern failed:', err.message);
    }
}

// ── Cache-Aside Wrapper ───────────────────────────────────────────────────────

/**
 * Cache-aside pattern:
 *   1. Check Redis for key
 *   2. HIT  → return cached value immediately (no DB call)
 *   3. MISS → call fetcher(), store result, return it
 *
 * If Redis is unavailable, fetcher() is always called (graceful degradation).
 */
export async function withCache(key, ttl, fetcher) {
    const cached = await cacheGet(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();

    // Fire-and-forget cache write — don't block the response
    cacheSet(key, fresh, ttl).catch(() => {});

    return fresh;
}

// ── Semantic Batch Invalidators ───────────────────────────────────────────────

/**
 * Invalidate all caches touched by a lead mutation (CREATE / UPDATE / DELETE).
 */
export async function invalidateOnLeadChange(verticalId, leadId) {
    // Only reports need invalidation since lead list and details are not cached in Redis (budget optimization)
    await cacheDeletePattern(`v1:reports:${verticalId}:*`);
}

/**
 * Invalidate all taxonomy caches (verticals, sub-verticals, field configs).
 * Pass verticalId to be surgical; omit to clear all taxonomy caches.
 */
export async function invalidateOnTaxonomyChange(verticalId) {
    const keys = ['verticals:list'];
    if (verticalId) {
        keys.push(
            `v1:vertical:${verticalId}:full`,
            `v1:sv:vertical:${verticalId}`,
            `field_configs:${verticalId}`,
        );
    }

    await Promise.all([
        cacheDelete(...keys),
        cacheDeletePattern('v1:vertical:*:full'),
        cacheDeletePattern('v1:sv:vertical:*'),
    ]);
}

/**
 * Flush L1 Cache (mainly for testing environment cleanup)
 */
export function flushL1Cache() {
    l1Cache.clear();
}
