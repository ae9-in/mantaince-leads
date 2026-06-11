/**
 * Redis Client — Upstash HTTP SDK
 *
 * Uses @upstash/redis which communicates over HTTPS (REST API) instead of
 * raw TCP. This means:
 *   ✅  No connection pool management needed
 *   ✅  No TLS configuration — all requests are HTTPS by default
 *   ✅  Works in serverless, ECS, and local environments identically
 *   ✅  No "select database" limitation (Upstash maps databases by key prefix)
 *   ✅  Values auto-serialized/deserialized as JSON
 *
 * The SDK reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env
 * automatically via Redis.fromEnv().
 */
import { Redis } from '@upstash/redis';

// Single shared client — HTTP is stateless, no pool needed
export const redis = Redis.fromEnv();

/**
 * Alias used by services/cache.js — keeps that module's import unchanged.
 * Both names point to the same client instance.
 */
export const cacheClient = redis;

/**
 * Called from app.js on startup. With Upstash, there is no persistent socket
 * to open — we just fire a PING to verify credentials and connectivity.
 */
export async function connectAllRedisClients() {
    try {
        const pong = await redis.ping();
        if (pong === 'PONG') {
            console.log('[Redis] Upstash connected ✅ (HTTP mode)');
        } else {
            console.warn('[Redis] Upstash PING returned unexpected:', pong);
        }
    } catch (error) {
        // Non-fatal: cache degrades gracefully — all cache calls fall back to DB
        console.error('[Redis] Upstash connection failed (non-fatal):', error.message);
    }
}
