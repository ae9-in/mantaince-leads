import { query } from '../config/db.js';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';
import { broadcastToAll } from '../services/assignmentBroadcaster.js';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../services/cache.js';

/**
 * GET /leads/:leadId/follow-ups
 */
export const getFollowUps = async (req, res) => {
  const { leadId } = req.params;
  const { status, assignedTo, from, to, search, sortBy = 'follow_up_date', sortDir = 'desc' } = req.query;
  try {
    // Check if lead exists and get vertical scoping
    const leadRes = await query('SELECT vertical_id, assigned_to FROM leads WHERE id = $1 AND is_deleted = false', [leadId]);
    const lead = leadRes.rows[0];
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
      return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
    }

    let sql = `
      SELECT f.*, 
             u_assign.name as assigned_to_name, u_assign.email as assigned_to_email,
             u_creator.name as creator_name, u_creator.email as creator_email
      FROM follow_ups f
      JOIN users u_assign ON f.assigned_to_id = u_assign.id
      JOIN users u_creator ON f.created_by_id = u_creator.id
      WHERE f.lead_id = $1
    `;
    const params = [leadId];
    let pIdx = 2;

    if (status) {
      sql += ` AND f.status = $${pIdx++}`;
      params.push(status);
    }
    
    // Agent role overrides query input to force agent sub
    const targetAssigned = req.user.role === 'agent' ? req.user.sub : assignedTo;
    if (targetAssigned) {
      sql += ` AND f.assigned_to_id = $${pIdx++}`;
      params.push(targetAssigned);
    }
    if (from) {
      sql += ` AND f.follow_up_date >= $${pIdx++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND f.follow_up_date <= $${pIdx++}`;
      params.push(to);
    }
    if (search) {
      sql += ` AND (u_assign.name ILIKE $${pIdx} OR u_assign.email ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }

    const orderCol = sortBy === 'followUpDate' ? 'follow_up_date' : 'follow_up_date';
    const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY f.${orderCol} ${orderDir}`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /leads/:leadId/follow-ups
 */
export const createFollowUp = async (req, res) => {
  const { leadId } = req.params;
  const { assignedToId, followUpDate, description, status = 'PENDING' } = req.body;

  if (!assignedToId || !followUpDate || !description) {
    return res.status(400).json({ success: false, error: 'assignedToId, followUpDate, and description are required' });
  }

  try {
    // Check if lead exists and get sub_vertical_id
    const leadRes = await query('SELECT sub_vertical_id, vertical_id, assigned_to, business_name FROM leads WHERE id = $1 AND is_deleted = false', [leadId]);
    const lead = leadRes.rows[0];
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
      return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
    }

    const subVerticalId = lead.sub_vertical_id;
    if (!subVerticalId) {
      return res.status(400).json({ success: false, error: 'Lead must be assigned to a sub-vertical before creating follow-ups' });
    }

    const id = crypto.randomUUID();
    const insertRes = await query(`
      INSERT INTO follow_ups (id, lead_id, sub_vertical_id, assigned_to_id, created_by_id, follow_up_date, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, leadId, subVerticalId, assignedToId, req.user.sub, followUpDate, description, status]);

    const newFollowUp = insertRes.rows[0];

    await logAudit(req, {
      action: 'FOLLOWUP_CREATED',
      targetCollection: 'follow_ups',
      targetId: newFollowUp.id,
      entityLabel: lead.business_name,
      after: newFollowUp
    });

    // Invalidate calendar cache
    await cacheDeletePattern('calendar:*');

    // Notify clients of lead mutation to trigger refresh
    broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'followup_create', leadId });

    return res.status(201).json({ success: true, data: newFollowUp });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /follow-ups/:id
 */
export const updateFollowUp = async (req, res) => {
  const { id } = req.params;
  const { assignedToId, followUpDate, description, status, completedNote } = req.body;

  try {
    const followUpRes = await query('SELECT * FROM follow_ups WHERE id = $1', [id]);
    const followUp = followUpRes.rows[0];
    if (!followUp) {
      return res.status(404).json({ success: false, error: 'Follow-up not found' });
    }

    // Get lead vertical_id and assigned operator
    const leadRes = await query('SELECT vertical_id, assigned_to, business_name FROM leads WHERE id = $1', [followUp.lead_id]);
    const lead = leadRes.rows[0];

    // Scoping check
    if (lead) {
      if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
        return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
      }
      if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
        return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
      }
    }

    const before = { ...followUp };
    const updates = [];
    const params = [id];
    let pIdx = 2;

    if (assignedToId) {
      updates.push(`assigned_to_id = $${pIdx++}`);
      params.push(assignedToId);
    }
    if (followUpDate) {
      updates.push(`follow_up_date = $${pIdx++}`);
      params.push(followUpDate);
    }
    if (description) {
      updates.push(`description = $${pIdx++}`);
      params.push(description);
    }
    if (status) {
      updates.push(`status = $${pIdx++}`);
      params.push(status);

      if (status === 'COMPLETED' && before.status !== 'COMPLETED') {
        updates.push(`completed_at = NOW()`);
      }
    }
    if (completedNote !== undefined) {
      updates.push(`completed_note = $${pIdx++}`);
      params.push(completedNote);
    }

    if (updates.length === 0) {
      return res.status(200).json({ success: true, data: followUp });
    }

    const updateRes = await query(`
      UPDATE follow_ups 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `, params);

    const updated = updateRes.rows[0];

    // Optional: Schedule NEXT follow-up automatically if details provided
    const { nextFollowUpDate, nextFollowUpDesc } = req.body;
    if (status === 'COMPLETED' && nextFollowUpDate && nextFollowUpDesc) {
      try {
        const nextId = crypto.randomUUID();
        await query(`
          INSERT INTO follow_ups (id, lead_id, sub_vertical_id, assigned_to_id, created_by_id, follow_up_date, description, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        `, [
          nextId, 
          followUp.lead_id, 
          followUp.sub_vertical_id, 
          followUp.assigned_to_id, 
          req.user.sub, 
          nextFollowUpDate, 
          nextFollowUpDesc
        ]);
      } catch (nextErr) {
        console.error('Failed to auto-schedule next follow-up:', nextErr);
      }
    }

    await logAudit(req, {
      action: status === 'COMPLETED' ? 'FOLLOWUP_COMPLETED' : 'FOLLOWUP_UPDATED',
      targetCollection: 'follow_ups',
      targetId: id,
      entityLabel: lead?.business_name,
      before,
      after: updated
    });

    // Invalidate calendar cache
    await cacheDeletePattern('calendar:*');

    // Notify clients of lead mutation to trigger refresh
    if (lead) {
      broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'followup_update', leadId: followUp.lead_id });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /follow-ups/:id
 */
export const deleteFollowUp = async (req, res) => {
  const { id } = req.params;
  try {
    const followUpRes = await query('SELECT * FROM follow_ups WHERE id = $1', [id]);
    const followUp = followUpRes.rows[0];
    if (!followUp) {
      return res.status(404).json({ success: false, error: 'Follow-up not found' });
    }

    const leadRes = await query('SELECT vertical_id, assigned_to, business_name FROM leads WHERE id = $1', [followUp.lead_id]);
    const lead = leadRes.rows[0];

    // Scoping check
    if (lead) {
      if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
        return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
      }
      if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
        return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
      }
    }

    await query('DELETE FROM follow_ups WHERE id = $1', [id]);

    await logAudit(req, {
      action: 'FOLLOWUP_DELETED',
      targetCollection: 'follow_ups',
      targetId: id,
      entityLabel: lead?.business_name,
      before: followUp
    });

    // Invalidate calendar cache
    await cacheDeletePattern('calendar:*');

    // Notify clients of lead mutation to trigger refresh
    if (lead) {
      broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'followup_delete', leadId: followUp.lead_id });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /leads/:leadId/follow-ups/summary
 */
export const getFollowUpSummary = async (req, res) => {
  const { leadId } = req.params;
  try {
    const leadRes = await query('SELECT vertical_id, assigned_to FROM leads WHERE id = $1 AND is_deleted = false', [leadId]);
    const lead = leadRes.rows[0];
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
      return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
    }

    const [pendingRes, totalRes, nextRes] = await Promise.all([
      query(`SELECT COUNT(*)::int as count FROM follow_ups WHERE lead_id = $1 AND status = 'PENDING'`, [leadId]),
      query(`SELECT COUNT(*)::int as count FROM follow_ups WHERE lead_id = $1`, [leadId]),
      query(`
        SELECT f.*, u.name as assigned_to_name 
        FROM follow_ups f 
        JOIN users u ON f.assigned_to_id = u.id 
        WHERE f.lead_id = $1 AND f.status = 'PENDING' 
        ORDER BY f.follow_up_date ASC 
        LIMIT 1
      `, [leadId])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pending: pendingRes.rows[0].count,
        total: totalRes.rows[0].count,
        nextFollowUp: nextRes.rows[0] || null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /verticals/:verticalId/follow-ups/calendar
 */
export const getCalendarGrid = async (req, res) => {
  const { verticalId } = req.params;
  const { year, month, assignedTo, subVerticalId } = req.query;

  if (!year || !month) {
    return res.status(400).json({ success: false, error: 'year and month are required' });
  }

  // Scoping check
  if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
    return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
  }

  // Agent role restriction
  const targetAssigned = req.user.role === 'agent' ? req.user.sub : assignedTo;

  const cacheKey = `calendar:${verticalId}:${year}-${month}:${targetAssigned || 'all'}:${subVerticalId || 'all'}`;

  try {
    // Check Cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached });
    }

    // Build date bounds
    const formattedMonth = String(month).padStart(2, '0');
    const startOfMonth = `${year}-${formattedMonth}-01`;

    let sql = `
      SELECT
        f.id,
        f.status,
        f.description,
        f.follow_up_date,
        l.name AS lead_name,
        l.business_name AS lead_business,
        DATE(f.follow_up_date AT TIME ZONE 'Asia/Kolkata')::text AS date
      FROM follow_ups f
      JOIN sub_verticals sv ON f.sub_vertical_id = sv.id
      LEFT JOIN leads l ON f.lead_id = l.id
      WHERE sv.vertical_id = $1
        AND DATE_TRUNC('month', f.follow_up_date) = DATE_TRUNC('month', $2::date)
    `;
    const params = [verticalId, startOfMonth];
    let pIdx = 3;

    if (targetAssigned) {
      sql += ` AND f.assigned_to_id = $${pIdx++}`;
      params.push(targetAssigned);
    }
    if (subVerticalId) {
      sql += ` AND f.sub_vertical_id = $${pIdx++}`;
      params.push(subVerticalId);
    }

    sql += ` ORDER BY f.follow_up_date ASC`;

    const result = await query(sql, params);
    
    // Group by date: { [dateStr: string]: { pending, completed, missed, total, items: [...] } }
    const calendar = {};
    result.rows.forEach(r => {
      const dateStr = r.date;
      if (!calendar[dateStr]) {
        calendar[dateStr] = {
          pending: 0,
          completed: 0,
          missed: 0,
          total: 0,
          items: []
        };
      }
      calendar[dateStr].total++;
      if (r.status === 'PENDING') calendar[dateStr].pending++;
      else if (r.status === 'COMPLETED') calendar[dateStr].completed++;
      else if (r.status === 'MISSED') calendar[dateStr].missed++;
      
      calendar[dateStr].items.push({
        id: r.id,
        status: r.status,
        description: r.description,
        leadName: r.lead_name,
        leadBusiness: r.lead_business,
        followUpDate: r.follow_up_date
      });
    });

    // Save to Cache (2 minutes TTL)
    await cacheSet(cacheKey, calendar, 120);

    return res.status(200).json({ success: true, data: calendar });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /verticals/:verticalId/follow-ups/by-date
 */
export const getCalendarFollowUpsByDate = async (req, res) => {
  const { verticalId } = req.params;
  const { date, assignedTo, subVerticalId } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, error: 'date query parameter is required' });
  }

  // Scoping check
  if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
    return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
  }

  // Agent role restriction
  const targetAssigned = req.user.role === 'agent' ? req.user.sub : assignedTo;

  try {
    let sql = `
      SELECT f.*, 
             l.name as lead_name, l.business_name as lead_business,
             u_assign.name as assigned_to_name, u_assign.email as assigned_to_email,
             u_creator.name as creator_name, u_creator.email as creator_email,
             sv.name as sub_vertical_name
      FROM follow_ups f
      JOIN leads l ON f.lead_id = l.id
      JOIN users u_assign ON f.assigned_to_id = u_assign.id
      JOIN users u_creator ON f.created_by_id = u_creator.id
      JOIN sub_verticals sv ON f.sub_vertical_id = sv.id
      WHERE sv.vertical_id = $1
        AND DATE(f.follow_up_date AT TIME ZONE 'Asia/Kolkata') = $2::date
    `;
    const params = [verticalId, date];
    let pIdx = 3;

    if (targetAssigned) {
      sql += ` AND f.assigned_to_id = $${pIdx++}`;
      params.push(targetAssigned);
    }
    if (subVerticalId) {
      sql += ` AND f.sub_vertical_id = $${pIdx++}`;
      params.push(subVerticalId);
    }

    sql += ` ORDER BY f.follow_up_date ASC`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /verticals/:verticalId/follow-ups/stats
 */
export const getFollowUpVerticalStats = async (req, res) => {
  const { verticalId } = req.params;
  const { subVerticalId, date } = req.query;

  // Scoping check
  if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
    return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
  }

  try {
    let baseSql = `
      FROM follow_ups f
      JOIN sub_verticals sv ON f.sub_vertical_id = sv.id
      WHERE sv.vertical_id = $1
    `;
    const params = [verticalId];
    let pIdx = 2;

    if (subVerticalId) {
      baseSql += ` AND f.sub_vertical_id = $${pIdx++}`;
      params.push(subVerticalId);
    }

    // Daily stats (for selected date)
    let dailySql = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE f.status = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE f.status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE f.status = 'MISSED') AS missed
      ${baseSql}
    `;
    const dailyParams = [...params];
    if (date) {
      dailySql += ` AND DATE(f.follow_up_date AT TIME ZONE 'Asia/Kolkata') = $${pIdx}::date`;
      dailyParams.push(date);
    } else {
      dailySql += ` AND DATE(f.follow_up_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`;
    }

    // All-time stats
    const allTimeSql = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE f.status = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE f.status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE f.status = 'MISSED') AS missed
      ${baseSql}
    `;

    const [dailyRes, allTimeRes] = await Promise.all([
      query(dailySql, dailyParams),
      query(allTimeSql, params)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        daily: dailyRes.rows[0] || { total: 0, pending: 0, completed: 0, missed: 0 },
        allTime: allTimeRes.rows[0] || { total: 0, pending: 0, completed: 0, missed: 0 }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
