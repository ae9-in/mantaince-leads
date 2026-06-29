import { query } from '../config/db.js';
import crypto from 'crypto';
import { broadcast, addClient, removeClient } from '../services/assignmentBroadcaster.js';
import { logAudit } from '../services/audit.js';
import { bulkInsert } from '../db/bulkInsert.js';
import { cacheDelete } from '../services/cache.js';

/**
 * SSE Stream Endpoint
 */
export const streamAssignments = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); 
  res.flushHeaders();

  const userId = req.role.name === 'super_admin' ? '__ADMIN__' : req.user.sub;
  addClient(userId, res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
    res.end();
  });
};

/**
 * Bulk Assign Sub-Verticals to User (Deprecated - No-Op)
 */
export const bulkAssign = async (req, res) => {
  return res.status(200).json({ 
    success: true, 
    data: [] 
  });
};

/**
 * Get current user's assigned sub-verticals (Deprecated - Returns empty array)
 */
export const getMySubVerticals = async (req, res) => {
  return res.status(200).json({ 
    success: true, 
    data: [] 
  });
};
