/**
 * Unified Cache Service — Bypassed/Direct Edition
 *
 * Implements direct database execution by bypassing cache-aside patterns.
 * Retains a small transient in-memory map ONLY for live CSV progress updates.
 */

// Transient store for live CSV progress updates
const csvProgressMap = new Map();

/**
 * Get a cached value. Bypasses all keys unless it is a live CSV progress query.
 */
export async function cacheGet(key) {
    if (!key || !key.startsWith('csv_progress:')) {
        return null;
    }
    const entry = csvProgressMap.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        csvProgressMap.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Store a value with a TTL (seconds). Restricted to transient CSV progress updates.
 */
export async function cacheSet(key, value, ttlSeconds) {
    if (!key || !key.startsWith('csv_progress:')) {
        return;
    }
    csvProgressMap.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}

/**
 * Delete one or more specific keys.
 */
export async function cacheDelete(...keys) {
    for (const key of keys) {
        if (key && key.startsWith('csv_progress:')) {
            csvProgressMap.delete(key);
        }
    }
}

/**
 * Delete all keys matching a pattern.
 */
export async function cacheDeletePattern(pattern) {
    // No-op since we only cache csv_progress
}

// ── Cache-Aside Wrapper ───────────────────────────────────────────────────────

/**
 * Cache-aside pattern bypass:
 * Always invoke fetcher directly to hit RDS database.
 */
export async function withCache(key, ttl, fetcher) {
    return fetcher();
}

// ── Semantic Batch Invalidators ───────────────────────────────────────────────

export async function invalidateOnLeadChange(verticalId, leadId) {
    // No-op
}

export async function invalidateOnTaxonomyChange(verticalId) {
    // No-op
}

/**
 * Flush Cache (mainly for testing environment cleanup)
 */
export function flushL1Cache() {
    csvProgressMap.clear();
}
