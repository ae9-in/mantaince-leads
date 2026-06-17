import { query } from '../config/db.js';
import crypto from 'crypto';

/**
 * Log an audit trail entry
 * Optimized: Runs asynchronously to avoid blocking the main request flow.
 */
export const logAudit = async (req, { action, targetCollection, targetId, before, after, metadata = {}, executionTimeMs = null }) => {
  // Fire and forget (or handle errors internally) to keep the API fast
  setImmediate(async () => {
    try {
      // Determine actor
      let actorId = null;
      if (req && req.user) {
        actorId = req.user.sub;
      }

      // Capture request details
      const ip = req ? (req.ip || (req.headers ? req.headers['x-forwarded-for'] : null) || (req.socket ? req.socket.remoteAddress : null) || '') : '';

      // Create audit log entry
      await query(`
        INSERT INTO audit_logs (id, actor_id, action, target_collection, target_id, diff, ip, execution_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        crypto.randomUUID(),
        actorId || null,
        action,
        targetCollection,
        targetId ? String(targetId) : null,
        JSON.stringify({ before, after, metadata }),
        String(ip).substring(0, 50),
        executionTimeMs
      ]);

    } catch (error) {
      console.error('❌ Failed to write audit log:', error.message);
    }
  });
};
