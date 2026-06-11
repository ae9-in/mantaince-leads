import { query } from '../config/db.js';
import crypto from 'crypto';
import { broadcast, addClient, removeClient } from '../services/assignmentBroadcaster.js';

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
 * Bulk Assign Sub-Verticals to User
 */
export const bulkAssign = async (req, res) => {
  const { userId, subVerticalIds } = req.body;

  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // 1. Deactivate old assignments
    await query('UPDATE user_assignments SET is_active = false WHERE user_id = $1', [userId]);

    // 2. Create new assignments
    if (subVerticalIds && subVerticalIds.length > 0) {
      for (const svId of subVerticalIds) {
        await query(`
          INSERT INTO user_assignments (id, user_id, sub_vertical_id, assigned_by, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (user_id, sub_vertical_id) DO UPDATE SET is_active = true, updated_at = NOW()
        `, [crypto.randomUUID(), userId, svId, req.user.sub]);
      }
    }

    // 3. Fetch full fresh list for broadcast
    const subVertsRes = await query(`
      SELECT sv.*, v.name as vertical_name 
      FROM sub_verticals sv 
      JOIN verticals v ON sv.vertical_id = v.id 
      WHERE sv.id = ANY($1)
    `, [subVerticalIds || []]);

    // 4. Broadcast
    broadcast(userId, {
      type: 'ASSIGNMENT_UPDATED',
      userId,
      assignments: subVertsRes.rows,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ 
      success: true, 
      data: subVertsRes.rows 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get current user's assigned sub-verticals
 */
export const getMySubVerticals = async (req, res) => {
  try {
    const subVertsRes = await query(`
      SELECT sv.*, v.name as vertical_name 
      FROM sub_verticals sv 
      JOIN verticals v ON sv.vertical_id = v.id 
      JOIN user_assignments ua ON sv.id = ua.sub_vertical_id 
      WHERE ua.user_id = $1 AND ua.is_active = true
    `, [req.user.sub]);
    
    return res.status(200).json({ 
      success: true, 
      data: subVertsRes.rows 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
