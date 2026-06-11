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

// ── Graceful Degradation ──────────────────────────────────────────────────────
// Track whether Upstash is reachable. On first successful operation, flips to
// true. On any error, flips back to false so the next request hits the DB.
let redisAvailable = false;

// Warm-up: try a quick PING to set initial availability state.
// This runs once at module load — non-blocking.
redis.ping().then(() => {
    redisAvailable = true;
    console.log('[Cache] Upstash ready');
}).catch((err) => {
    redisAvailable = false;
    console.error('[Cache] Upstash unavailable on startup:', err.message);
});

// ── Primitives ────────────────────────────────────────────────────────────────

/**
 * Get a cached value.
 * @upstash/redis already deserializes JSON — returns the parsed value directly.
 * Returns null on cache miss or if Redis is unavailable.
 */
export async function cacheGet(key) {
    if (!redisAvailable) return null;
    try {
        const value = await redis.get(key);
        return value ?? null;
    } catch {
        redisAvailable = false;
        return null;
    }
}

/**
 * Store a value with a TTL (seconds).
 * @upstash/redis auto-serializes the value to JSON.
 */
export async function cacheSet(key, value, ttlSeconds) {
    if (!redisAvailable) return;
    try {
        await redis.set(key, value, { ex: ttlSeconds });
        redisAvailable = true;
    } catch (err) {
        redisAvailable = false;
        console.error('[Cache] set failed:', err.message);
    }
}

/**
 * Delete one or more specific keys.
 */
export async function cacheDelete(...keys) {
    if (!redisAvailable || keys.length === 0) return;
    try {
        // @upstash/redis del accepts spread args: del(k1, k2, k3)
        await redis.del(...keys);
    } catch (err) {
        console.error('[Cache] del failed:', err.message);
    }
}

/**
 * Delete all keys matching a glob pattern (SCAN-based, non-blocking).
 * @upstash/redis scan returns [nextCursor, keys] (array, not object).
 */
export async function cacheDeletePattern(pattern) {
    if (!redisAvailable) return;
    try {
        let cursor = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 200 });
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== 0 && cursor !== '0');
    } catch (err) {
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
    const singleKeys = leadId ? [`v1:lead:${leadId}:detail`] : [];

    await Promise.all([
        singleKeys.length ? cacheDelete(...singleKeys) : Promise.resolve(),
        cacheDeletePattern(`v1:leads:${verticalId}:list:*`),
        cacheDeletePattern(`v1:reports:${verticalId}:*`),
    ]);
}

/**
 * Invalidate all taxonomy caches (verticals, sub-verticals, field configs).
 * Pass verticalId to be surgical; omit to clear all taxonomy caches.
 */
export async function invalidateOnTaxonomyChange(verticalId) {
    const keys = ['v1:verticals:all'];
    if (verticalId) {
        keys.push(
            `v1:vertical:${verticalId}:full`,
            `v1:sv:vertical:${verticalId}`,
            `v1:configs:${verticalId}:fields`,
        );
    }

    await Promise.all([
        cacheDelete(...keys),
        cacheDeletePattern('v1:vertical:*:full'),
        cacheDeletePattern('v1:sv:vertical:*'),
    ]);
}
