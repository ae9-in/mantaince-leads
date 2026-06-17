import { query } from '../config/db.js';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';
import { broadcastToAll } from '../services/assignmentBroadcaster.js';

// ── 1. Search employees by sub-vertical ──
export const getUsersBySubVertical = async (req, res) => {
  const { subVerticalId } = req.params;
  try {
    const result = await query(`
      SELECT DISTINCT u.id, u.name, u.email, r.name as role 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      JOIN user_assignments ua ON u.id = ua.user_id 
      WHERE ua.sub_vertical_id = $1 AND ua.is_active = true AND u.is_active = true
    `, [subVerticalId]);
    
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ── 3. Custom Fields CRUD ──
export const getCustomFields = async (req, res) => {
  const { subVerticalId } = req.params;
  try {
    const result = await query(`
      SELECT * FROM custom_fields 
      WHERE sub_vertical_id = $1 AND is_deleted = false 
      ORDER BY "order" ASC
    `, [subVerticalId]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createCustomField = async (req, res) => {
  const { subVerticalId } = req.params;
  const { label, fieldKey, fieldType, isRequired, placeholder, options } = req.body;

  if (!label || !fieldKey || !fieldType) {
    return res.status(400).json({ success: false, error: 'label, fieldKey, and fieldType are required' });
  }

  try {
    const dupRes = await query(`
      SELECT 1 FROM custom_fields 
      WHERE sub_vertical_id = $1 AND field_key = $2 AND is_deleted = false
    `, [subVerticalId, fieldKey]);

    if (dupRes.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Field key already exists in this sub-vertical' });
    }

    const orderRes = await query(`
      SELECT COALESCE(MAX("order"), -1) + 1 as next_order 
      FROM custom_fields 
      WHERE sub_vertical_id = $1 AND is_deleted = false
    `, [subVerticalId]);
    const nextOrder = orderRes.rows[0].next_order;

    const id = crypto.randomUUID();
    const insertRes = await query(`
      INSERT INTO custom_fields (id, sub_vertical_id, label, field_key, field_type, is_required, placeholder, options, "order")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      id, subVerticalId, label, fieldKey, fieldType,
      isRequired === true, placeholder || '', options || [], nextOrder
    ]);

    const newField = insertRes.rows[0];

    await logAudit(req, {
      action: 'CUSTOM_FIELD_CREATED',
      targetCollection: 'custom_fields',
      targetId: newField.id,
      after: newField
    });

    const subRes = await query('SELECT vertical_id FROM sub_verticals WHERE id = $1', [subVerticalId]);
    const verticalId = subRes.rows[0]?.vertical_id;
    if (verticalId) {
      broadcastToAll({ type: 'LEAD_MUTATED', verticalId, action: 'custom_field_create' });
    }

    return res.status(201).json({ success: true, data: newField });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateCustomField = async (req, res) => {
  const { id } = req.params;
  const { label, fieldType, isRequired, placeholder, options, isActive } = req.body;

  try {
    const fieldRes = await query('SELECT * FROM custom_fields WHERE id = $1', [id]);
    const field = fieldRes.rows[0];
    if (!field) {
      return res.status(404).json({ success: false, error: 'Custom field not found' });
    }

    const before = { ...field };
    const updates = [];
    const params = [id];
    let pIdx = 2;

    if (label) {
      updates.push(`label = $${pIdx++}`);
      params.push(label);
    }
    if (fieldType) {
      updates.push(`field_type = $${pIdx++}`);
      params.push(fieldType);
    }
    if (isRequired !== undefined) {
      updates.push(`is_required = $${pIdx++}`);
      params.push(isRequired === true);
    }
    if (placeholder !== undefined) {
      updates.push(`placeholder = $${pIdx++}`);
      params.push(placeholder);
    }
    if (options !== undefined) {
      updates.push(`options = $${pIdx++}`);
      params.push(options);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${pIdx++}`);
      params.push(isActive === true);
    }

    if (updates.length === 0) {
      return res.status(200).json({ success: true, data: field });
    }

    const updateRes = await query(`
      UPDATE custom_fields 
      SET ${updates.join(', ')} 
      WHERE id = $1 
      RETURNING *
    `, params);

    const updated = updateRes.rows[0];

    await logAudit(req, {
      action: 'CUSTOM_FIELD_UPDATED',
      targetCollection: 'custom_fields',
      targetId: id,
      before,
      after: updated
    });

    const subRes = await query('SELECT vertical_id FROM sub_verticals WHERE id = $1', [field.sub_vertical_id]);
    const verticalId = subRes.rows[0]?.vertical_id;
    if (verticalId) {
      broadcastToAll({ type: 'LEAD_MUTATED', verticalId, action: 'custom_field_update' });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteCustomField = async (req, res) => {
  const { id } = req.params;
  try {
    const fieldRes = await query('SELECT * FROM custom_fields WHERE id = $1', [id]);
    const field = fieldRes.rows[0];
    if (!field) {
      return res.status(404).json({ success: false, error: 'Custom field not found' });
    }

    // Soft delete custom field and delete custom field values in parallel
    await Promise.all([
      query('UPDATE custom_fields SET is_deleted = true WHERE id = $1', [id]),
      query('DELETE FROM lead_custom_values WHERE custom_field_id = $1', [id])
    ]);

    await logAudit(req, {
      action: 'CUSTOM_FIELD_DELETED',
      targetCollection: 'custom_fields',
      targetId: id,
      before: field
    });

    const subRes = await query('SELECT vertical_id FROM sub_verticals WHERE id = $1', [field.sub_vertical_id]);
    const verticalId = subRes.rows[0]?.vertical_id;
    if (verticalId) {
      broadcastToAll({ type: 'LEAD_MUTATED', verticalId, action: 'custom_field_delete' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const reorderCustomFields = async (req, res) => {
  const { subVerticalId } = req.params;
  const { orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({ success: false, error: 'orderedIds array is required' });
  }

  try {
    const updatePromises = orderedIds.map((id, index) => 
      query(`
        UPDATE custom_fields 
        SET "order" = $1 
        WHERE id = $2 AND sub_vertical_id = $3
      `, [index, id, subVerticalId])
    );
    await Promise.all(updatePromises);

    const listRes = await query(`
      SELECT * FROM custom_fields 
      WHERE sub_vertical_id = $1 AND is_deleted = false 
      ORDER BY "order" ASC
    `, [subVerticalId]);

    const subRes = await query('SELECT vertical_id FROM sub_verticals WHERE id = $1', [subVerticalId]);
    const verticalId = subRes.rows[0]?.vertical_id;
    if (verticalId) {
      broadcastToAll({ type: 'LEAD_MUTATED', verticalId, action: 'custom_field_reorder' });
    }

    await logAudit(req, {
      action: 'CUSTOM_FIELD_REORDERED',
      targetCollection: 'custom_fields',
      targetId: subVerticalId,
      after: listRes.rows
    });

    return res.status(200).json({ success: true, data: listRes.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ── 4. Visual Admin Audit Logs ──
export const getAdminAuditLogs = async (req, res) => {
  const { userId, action, entityType, from, to, search, cursor, limit = 50 } = req.query;
  try {
    let sql = `
      SELECT a.*, u.name as user_name, u.email as user_email, r.name as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    const params = [];
    const wheres = [];
    let pIdx = 1;

    if (userId) {
      wheres.push(`a.actor_id = $${pIdx++}`);
      params.push(userId);
    }
    if (action) {
      wheres.push(`a.action = $${pIdx++}`);
      params.push(action);
    }
    if (entityType) {
      wheres.push(`a.target_collection = $${pIdx++}`);
      params.push(entityType);
    }
    if (from) {
      wheres.push(`a.created_at >= $${pIdx++}`);
      params.push(from);
    }
    if (to) {
      wheres.push(`a.created_at <= $${pIdx++}`);
      params.push(to);
    }
    if (search) {
      wheres.push(`(u.name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR a.target_id::text ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (cursor) {
      wheres.push(`a.created_at < $${pIdx++}`);
      params.push(new Date(cursor));
    }

    if (wheres.length > 0) {
      sql += ' WHERE ' + wheres.join(' AND ');
    }

    sql += ` ORDER BY a.created_at DESC LIMIT $${pIdx++}`;
    const limitNum = parseInt(limit, 10) || 50;
    params.push(limitNum + 1);

    const result = await query(sql, params);
    const rows = result.rows;
    const hasNextPage = rows.length > limitNum;
    if (hasNextPage) rows.pop();

    const nextCursor = hasNextPage && rows.length > 0
      ? rows[rows.length - 1].created_at.toISOString()
      : null;

    // Adapt to standard format expected by the frontend
    const adaptedRows = rows.map(r => {
      let before = null;
      let after = null;
      let diffVal = r.diff;
      if (typeof diffVal === 'string') {
        try {
          diffVal = JSON.parse(diffVal);
        } catch {}
      }
      if (diffVal) {
        before = diffVal.before;
        after = diffVal.after;
      }
      return {
        id: r.id,
        userId: r.actor_id,
        userEmail: r.user_email || 'System / Unattributed',
        userRole: r.user_role || 'system',
        userName: r.user_name || 'System',
        action: r.action,
        entityType: r.target_collection,
        entityId: r.target_id,
        entityLabel: r.entity_label || `${r.target_collection} (${String(r.target_id).slice(0,8)})`,
        oldValue: before,
        newValue: after,
        ipAddress: r.ip,
        userAgent: r.userAgent,
        createdAt: r.created_at
      };
    });

    return res.status(200).json({
      success: true,
      data: adaptedRows,
      meta: {
        nextCursor
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ── 5. Sub-vertical Stages CRUD ──
export const getSubVerticalStages = async (req, res) => {
  const { subVerticalId } = req.params;
  try {
    const result = await query(`
      SELECT * FROM lead_stages 
      WHERE sub_vertical_id = $1 
      ORDER BY display_order ASC
    `, [subVerticalId]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createSubVerticalStage = async (req, res) => {
  const { subVerticalId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Stage name is required' });
  }

  try {
    const orderRes = await query(`
      SELECT COALESCE(MAX(display_order), -1) + 1 as next_order 
      FROM lead_stages 
      WHERE sub_vertical_id = $1
    `, [subVerticalId]);
    const nextOrder = orderRes.rows[0].next_order;

    const id = crypto.randomUUID();
    const insertRes = await query(`
      INSERT INTO lead_stages (id, sub_vertical_id, name, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, subVerticalId, name, nextOrder]);

    const newStage = insertRes.rows[0];

    await logAudit(req, {
      action: 'STAGE_CREATED',
      targetCollection: 'lead_stages',
      targetId: newStage.id,
      after: newStage
    });

    return res.status(201).json({ success: true, data: newStage });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSubVerticalStage = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Stage name is required' });
  }

  try {
    const stageRes = await query('SELECT * FROM lead_stages WHERE id = $1', [id]);
    const stage = stageRes.rows[0];
    if (!stage) {
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }

    const before = { ...stage };
    const updateRes = await query(`
      UPDATE lead_stages 
      SET name = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `, [name, id]);

    const updated = updateRes.rows[0];

    await logAudit(req, {
      action: 'STAGE_UPDATED',
      targetCollection: 'lead_stages',
      targetId: id,
      before,
      after: updated
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteSubVerticalStage = async (req, res) => {
  const { id } = req.params;
  try {
    const stageRes = await query('SELECT * FROM lead_stages WHERE id = $1', [id]);
    const stage = stageRes.rows[0];
    if (!stage) {
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }

    // Dissociate leads referencing this stage and delete the stage in parallel
    await Promise.all([
      query('UPDATE leads SET stage_id = NULL WHERE stage_id = $1', [id]),
      query('DELETE FROM lead_stages WHERE id = $1', [id])
    ]);

    await logAudit(req, {
      action: 'STAGE_DELETED',
      targetCollection: 'lead_stages',
      targetId: id,
      before: stage
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const reorderSubVerticalStages = async (req, res) => {
  const { subVerticalId } = req.params;
  const { orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({ success: false, error: 'orderedIds array is required' });
  }

  try {
    const updatePromises = orderedIds.map((id, index) => 
      query(`
        UPDATE lead_stages 
        SET display_order = $1, updated_at = NOW() 
        WHERE id = $2 AND sub_vertical_id = $3
      `, [index, id, subVerticalId])
    );
    await Promise.all(updatePromises);

    const listRes = await query(`
      SELECT * FROM lead_stages 
      WHERE sub_vertical_id = $1 
      ORDER BY display_order ASC
    `, [subVerticalId]);

    await logAudit(req, {
      action: 'STAGE_REORDERED',
      targetCollection: 'lead_stages',
      targetId: subVerticalId,
      after: listRes.rows
    });

    return res.status(200).json({ success: true, data: listRes.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getAdminDashboardStats = async (req, res) => {
  try {
    const [vertsRes, subsRes, leadsRes] = await Promise.all([
      query('SELECT id, name, slug, color, is_active FROM verticals ORDER BY name'),
      query('SELECT id, vertical_id, name, slug, is_active FROM sub_verticals ORDER BY name'),
      query(`
        SELECT 
          vertical_id, 
          sub_vertical_id, 
          status, 
          COUNT(*)::int AS count 
        FROM leads 
        WHERE is_deleted = false 
        GROUP BY vertical_id, sub_vertical_id, status
      `)
    ]);

    const verticals = vertsRes.rows;
    const subVerticals = subsRes.rows;
    const leadStats = leadsRes.rows;

    const accessibleVerticals = req.user.role === 'super_admin'
      ? verticals
      : verticals.filter(v => req.user.verticalAccess && req.user.verticalAccess.includes(v.id));

    const statsMap = {};
    leadStats.forEach(stat => {
      const vId = stat.vertical_id;
      const svId = stat.sub_vertical_id || 'vertical_level';
      const status = stat.status;
      const count = stat.count;

      if (!statsMap[vId]) statsMap[vId] = { total: 0, converted: 0, byStatus: {}, subs: {} };
      statsMap[vId].total += count;
      if (status === 'converted') statsMap[vId].converted += count;
      statsMap[vId].byStatus[status] = (statsMap[vId].byStatus[status] || 0) + count;

      if (svId !== 'vertical_level') {
        if (!statsMap[vId].subs[svId]) statsMap[vId].subs[svId] = { total: 0, converted: 0, byStatus: {} };
        statsMap[vId].subs[svId].total += count;
        if (status === 'converted') statsMap[vId].subs[svId].converted += count;
        statsMap[vId].subs[svId].byStatus[status] = (statsMap[vId].subs[svId].byStatus[status] || 0) + count;
      }
    });

    const result = accessibleVerticals.map(v => {
      const vStats = statsMap[v.id] || { total: 0, converted: 0, byStatus: {}, subs: {} };
      const vSubs = subVerticals.filter(sv => sv.vertical_id === v.id).map(sv => {
        const svStats = vStats.subs[sv.id] || { total: 0, converted: 0, byStatus: {} };
        return {
          id: sv.id,
          name: sv.name,
          slug: sv.slug,
          isActive: sv.is_active,
          totalLeads: svStats.total,
          convertedLeads: svStats.converted,
          conversionRate: svStats.total > 0 ? parseFloat(((svStats.converted / svStats.total) * 100).toFixed(2)) : 0,
          statusDistribution: svStats.byStatus
        };
      });

      return {
        id: v.id,
        name: v.name,
        slug: v.slug,
        color: v.color,
        isActive: v.is_active,
        totalLeads: vStats.total,
        convertedLeads: vStats.converted,
        conversionRate: vStats.total > 0 ? parseFloat(((vStats.converted / vStats.total) * 100).toFixed(2)) : 0,
        statusDistribution: vStats.byStatus,
        subVerticals: vSubs
      };
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
