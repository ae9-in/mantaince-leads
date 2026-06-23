import { query } from '../config/db.js';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';
import { isValidUUID } from '../utils/validators/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    withCache, cacheGet, cacheSet, cacheDelete,
    invalidateOnLeadChange
} from '../services/cache.js';
import { CacheKeys, TTL, hashLeadListParams } from '../lib/cacheKeys.js';
import { broadcastToAll } from '../services/assignmentBroadcaster.js';
import { z } from 'zod';
import { bulkInsert } from '../db/bulkInsert.js';

// ── Cursor helpers ─────────────────────────────────────────────────────────────
// Encode/decode opaque cursors so the client never sees raw timestamps / UUIDs.

function encodeCursor(createdAt, id) {
    return Buffer.from(JSON.stringify({ t: createdAt, i: id })).toString('base64url');
}

function decodeCursor(cursor) {
    try {
        const { t, i } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        return { createdAt: t, id: i };
    } catch {
        return null;
    }
}

// ── Column whitelist for ORDER BY injection protection ─────────────────────────
const SORT_COLUMN_MAP = {
    createdAt:     'l.created_at',
    updatedAt:     'l.updated_at',
    businessName:  'l.business_name',
    name:          'l.name',
    status:        'l.status',
};

/**
 * GET /leads
 *
 * Implements cursor-based pagination (O(log n) at any depth) to replace
 * offset pagination which degrades as O(n) at high page numbers.
 *
 * Response shape:
 *   { success, data: [...], meta: { nextCursor, prevCursor, hasNextPage, hasPrevPage, limit } }
 *
 * Cursor usage: pass ?cursor=<nextCursor> to get the next page.
 */
export const getLeads = async (req, res) => {
    const {
        verticalId,
        subVerticalId,
        status,
        area,
        assignedTo,
        search,
        limit     = 25,
        cursor,
        sortBy    = 'createdAt',
        sortDir   = 'desc',
        dateFrom,
        dateTo,
        includeCount = 'false',
        csvBatchId,
        leadType,
        stageId,
    } = req.query;

    try {
        if (!verticalId || !isValidUUID(verticalId)) {
            return res.status(200).json({
                success: true,
                data: [],
                meta: { nextCursor: null, prevCursor: null, hasNextPage: false, hasPrevPage: false, limit: 25 }
            });
        }

        // RBAC: non-super_admin must have access to this vertical
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
        const dir      = sortDir === 'asc' ? 'ASC' : 'DESC';
        const sortCol  = ['createdAt', 'updatedAt', 'businessName', 'name', 'status'].includes(sortBy) ? SORT_COLUMN_MAP[sortBy] : 'l.created_at';
        const agentId  = req.user.role === 'agent' ? req.user.sub : null;

        // ── Build WHERE clauses dynamically ───────────────────────────────
        const params  = [verticalId];
        const wheres  = ['l.vertical_id = $1', 'l.is_deleted = false'];
        let   pIdx    = 2;

        // RBAC: agent only sees their own leads
        if (agentId) {
            wheres.push(`l.assigned_to = $${pIdx++}`);
            params.push(agentId);
        }

        if (subVerticalId && isValidUUID(subVerticalId)) {
            wheres.push(`l.sub_vertical_id = $${pIdx++}`);
            params.push(subVerticalId);
        }
        if (status) {
            wheres.push(`l.status = $${pIdx++}`);
            params.push(status);
        }
        if (assignedTo && isValidUUID(assignedTo)) {
            wheres.push(`l.assigned_to = $${pIdx++}`);
            params.push(assignedTo);
        }
        if (area) {
            wheres.push(`l.data->>'area' = $${pIdx++}`);
            params.push(area);
        }
        if (dateFrom) {
            wheres.push(`l.created_at >= $${pIdx++}`);
            params.push(dateFrom);
        }
        if (dateTo) {
            wheres.push(`l.created_at <= $${pIdx++}`);
            params.push(dateTo);
        }
        if (csvBatchId && isValidUUID(csvBatchId)) {
            wheres.push(`l.csv_batch_id = $${pIdx++}`);
            params.push(csvBatchId);
        }
        if (leadType) {
            wheres.push(`l.lead_type = $${pIdx++}`);
            params.push(leadType);
        }
        if (stageId && isValidUUID(stageId)) {
            wheres.push(`l.stage_id = $${pIdx++}`);
            params.push(stageId);
        }

        // ── Full-text search vs. ILIKE fallback ───────────────────────────
        if (search && search.trim().length >= 2) {
            const q = search.trim();
            // Use tsvector FTS for multi-word queries — uses GIN index
            // Fall back to trigram ILIKE for single partial terms (e.g. '074')
            if (q.includes(' ') || q.length >= 4) {
                // tsquery: each word must be present (prefix match with :*)
                const tsQuery = q.trim().split(/\s+/).map(w => `${w}:*`).join(' & ');
                wheres.push(`l.search_vector @@ to_tsquery('english', $${pIdx++})`);
                params.push(tsQuery);
            } else {
                // Short partial match: trigram index handles this efficiently
                wheres.push(
                    `(l.name ILIKE $${pIdx} OR l.business_name ILIKE $${pIdx} OR l.phone ILIKE $${pIdx})`
                );
                params.push(`%${q}%`);
                pIdx++;
            }
        }

        // ── Cursor-based pagination WHERE clause ──────────────────────────
        // Instead of OFFSET (which scans discarded rows), we use a composite
        // keyset: (created_at, id) which gives O(log n) seeks at any depth.
        let cursorData = null;
        if (cursor) {
            cursorData = decodeCursor(cursor);
            if (cursorData) {
                const op = dir === 'DESC' ? '<' : '>';
                // Composite keyset: (created_at op ?) OR (created_at = ? AND id op ?)
                // This ensures a stable, duplicate-free cursor even with identical timestamps
                wheres.push(
                    `(${sortCol} ${op} $${pIdx} OR (${sortCol} = $${pIdx} AND l.id ${op} $${pIdx + 1}))`
                );
                params.push(cursorData.createdAt, cursorData.id);
                pIdx += 2;
            }
        }

        const whereClause = wheres.join(' AND ');

        // ── Data query: explicit projection — no SELECT * ─────────────────
        // Joining users + sub_verticals in one SQL so the controller fires
        // exactly 1 query (vs. N+1 with separate lookups per lead).
        const leadsSql = `
            SELECT
                l.id, l.name, l.phone, l.business_name,
                l.status, l.source, l.data,
                l.vertical_id, l.sub_vertical_id,
                l.assigned_to, l.created_at, l.updated_at,
                l.lead_type,
                l.geotag_lat, l.geotag_lng, l.geotag_accuracy,
                l.geotag_photo_key, l.geotag_address, l.geotag_captured_at,
                l.stage_id,
                -- Assignee name (LEFT JOIN — may be null)
                u.name       AS assignee_name,
                u.email      AS assignee_email,
                -- Sub-vertical name (LEFT JOIN — may be null)
                sv.name      AS sub_vertical_name
            FROM leads l
            LEFT JOIN users         u   ON u.id   = l.assigned_to
            LEFT JOIN sub_verticals sv  ON sv.id  = l.sub_vertical_id
            WHERE ${whereClause}
            ORDER BY ${sortCol} ${dir}, l.id ${dir}
            LIMIT $${pIdx}
        `;
        params.push(limitNum + 1); // Fetch one extra to detect next page

        // ── Parallel execution: data + optional total count ───────────────
        const shouldCount = includeCount === 'true';
        const countSql    = `SELECT COUNT(*) FROM leads l WHERE ${whereClause}`;

        const [leadsRes, countRes] = await Promise.all([
            query(leadsSql, params),
            shouldCount ? query(countSql, params.slice(0, -1)) : Promise.resolve(null),
        ]);

        const rows        = leadsRes.rows;
        const hasNextPage = rows.length > limitNum;
        if (hasNextPage) rows.pop();

        const hasPrevPage = !!cursorData;
        const nextCursor  = hasNextPage && rows.length > 0
            ? encodeCursor(rows[rows.length - 1].created_at, rows[rows.length - 1].id)
            : null;
        const prevCursor  = hasPrevPage && rows.length > 0
            ? encodeCursor(rows[0].created_at, rows[0].id)
            : null;

        const response = {
            success: true,
            data: rows,
            meta: {
                nextCursor,
                prevCursor,
                hasNextPage,
                hasPrevPage,
                limit: limitNum,
                total: (shouldCount && countRes && countRes.rows && countRes.rows.length > 0) ? (() => {
                    const [firstRow] = countRes.rows;
                    return parseInt(firstRow.count, 10);
                })() : undefined,
            }
        };

        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /leads
 *
 * Uses a single CTE query that atomically checks for phone duplicates and
 * inserts in one round-trip instead of two serial queries.
 */
export const createLead = async (req, res) => {
    const { 
        name, phone, businessName, verticalId, subVerticalId, assignedTo, 
        data = {}, leadType = 'CALL', 
        geotagLat, geotagLng, geotagAccuracy, geotagPhotoKey, geotagAddress, geotagCapturedAt,
        customValues = {}, stageId,
        status = 'new'
    } = req.body;

    if (!isValidUUID(verticalId)) {
        return res.status(400).json({ success: false, error: 'Invalid vertical ID format' });
    }
    try {
        if (!subVerticalId || !isValidUUID(subVerticalId)) {
            return res.status(400).json({ success: false, error: 'Sub-vertical selection is mandatory for creating leads.' });
        }

        // RBAC scoping
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        // Atomic dedup-check + INSERT via CTE — avoids two serial round-trips
        // The INSERT only proceeds if no active lead with the same phone exists.
        const leadId = crypto.randomUUID();
        let leadRes;

        const gLat = geotagLat ? parseFloat(geotagLat) : null;
        const gLng = geotagLng ? parseFloat(geotagLng) : null;
        const gAcc = geotagAccuracy ? parseFloat(geotagAccuracy) : null;
        const gCap = geotagCapturedAt ? new Date(geotagCapturedAt) : null;

        if (phone) {
            leadRes = await query(`
                WITH dedup AS (
                    SELECT id FROM leads
                    WHERE phone = $1 AND vertical_id = $2 AND is_deleted = false
                    LIMIT 1
                )
                INSERT INTO leads
                    (id, vertical_id, sub_vertical_id, assigned_to, uploaded_by, name, phone, business_name, data, status,
                     lead_type, geotag_lat, geotag_lng, geotag_accuracy, geotag_photo_key, geotag_address, geotag_captured_at, stage_id)
                SELECT $3, $2, $4, $5, $6, $7, $1, $8, $9, $18,
                       $10, $11, $12, $13, $14, $15, $16, $17
                WHERE NOT EXISTS (SELECT 1 FROM dedup)
                RETURNING *
            `, [
                phone, verticalId,
                leadId,
                (subVerticalId && isValidUUID(subVerticalId)) ? subVerticalId : null,
                (assignedTo    && isValidUUID(assignedTo))    ? assignedTo    : null,
                req.user.sub,
                name, businessName || '', JSON.stringify(data),
                leadType || 'CALL',
                gLat, gLng, gAcc,
                geotagPhotoKey || null,
                geotagAddress || null,
                gCap,
                (stageId       && isValidUUID(stageId))       ? stageId       : null,
                status || 'new'
            ]);

            if (leadRes.rows.length === 0) {
                return res.status(409).json({ success: false, error: 'Lead with this phone number already exists' });
            }
        } else {
            leadRes = await query(`
                INSERT INTO leads
                    (id, vertical_id, sub_vertical_id, assigned_to, uploaded_by, name, phone, business_name, data, status,
                     lead_type, geotag_lat, geotag_lng, geotag_accuracy, geotag_photo_key, geotag_address, geotag_captured_at, stage_id)
                VALUES ($1, $2, $3, $4, $5, $6, '', $7, $8, $17,
                        $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `, [
                leadId, verticalId,
                (subVerticalId && isValidUUID(subVerticalId)) ? subVerticalId : null,
                (assignedTo    && isValidUUID(assignedTo))    ? assignedTo    : null,
                req.user.sub,
                name, businessName || '', JSON.stringify(data),
                leadType || 'CALL',
                gLat, gLng, gAcc,
                geotagPhotoKey || null,
                geotagAddress || null,
                gCap,
                (stageId       && isValidUUID(stageId))       ? stageId       : null,
                status || 'new'
            ]);
        }

        const lead = leadRes.rows[0];

        // Process Custom Fields values if sub-vertical custom fields exist
        if (subVerticalId && customValues && Object.keys(customValues).length > 0) {
            const customFieldsRes = await query(
                'SELECT id, field_key, is_required, validation_regex, validation_message FROM custom_fields WHERE sub_vertical_id = $1 AND is_active = true',
                [subVerticalId]
            );
            
            const customInsertPromises = [];
            for (const field of customFieldsRes.rows) {
                const val = customValues[field.field_key];
                if (field.is_required && (val === undefined || val === null || val === '')) {
                    return res.status(400).json({ success: false, error: `Custom field '${field.field_key}' is required` });
                }
                
                if (val !== undefined && val !== null && val !== '') {
                    if (field.validation_regex) {
                        try {
                            const rx = new RegExp(field.validation_regex);
                            if (!rx.test(val.toString())) {
                                return res.status(400).json({ success: false, error: field.validation_message || `Invalid format for '${field.field_key}'` });
                            }
                        } catch (e) {
                            if (e.message.includes('Invalid format')) {
                                return res.status(400).json({ success: false, error: e.message });
                            }
                        }
                    }
                    
                    const valId = crypto.randomUUID();
                    customInsertPromises.push(
                        query(`
                            INSERT INTO lead_custom_values (id, lead_id, custom_field_id, value)
                            VALUES ($1, $2, $3, $4)
                            ON CONFLICT (lead_id, custom_field_id) DO UPDATE SET value = EXCLUDED.value
                        `, [valId, leadId, field.id, String(val)])
                    );
                }
            }
            if (customInsertPromises.length > 0) {
                await Promise.all(customInsertPromises);
            }
        }

        // Invalidate lead list cache for this vertical
        await invalidateOnLeadChange(verticalId, null);

        broadcastToAll({ type: 'LEAD_MUTATED', verticalId, action: 'create' });

        logAudit(req, { action: 'lead.create', targetCollection: 'leads', targetId: lead.id, after: lead });

        return res.status(201).json({ success: true, data: lead });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};


/**
 * GET /leads/:id
 *
 * Returns the full lead detail with assignee and sub-vertical info embedded.
 * Result is cached for 15 minutes.
 */
export const getLeadById = async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    try {
        // Single query with all joins — no N+1
        const res2 = await query(`
            SELECT
                l.*,
                u.id    AS assignee_id,
                u.name  AS assignee_name,
                u.email AS assignee_email,
                sv.id   AS sv_id,
                sv.name AS sv_name,
                v.name  AS vertical_name,
                v.color AS vertical_color
            FROM leads l
            LEFT JOIN users         u  ON u.id  = l.assigned_to
            LEFT JOIN sub_verticals sv ON sv.id = l.sub_vertical_id
            LEFT JOIN verticals     v  ON v.id  = l.vertical_id
            WHERE l.id = $1
        `, [id]);

        const lead = res2.rows[0];
        if (!lead || lead.is_deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        // Fetch custom fields values
        const customValuesRes = await query(`
            SELECT cf.field_key, lcv.value
            FROM lead_custom_values lcv
            JOIN custom_fields cf ON lcv.custom_field_id = cf.id
            WHERE lcv.lead_id = $1
        `, [id]);
        
        const customValues = {};
        customValuesRes.rows.forEach(row => {
            customValues[row.field_key] = row.value;
        });
        lead.customValues = customValues;


        // RBAC checks run after fetch — cheap in-memory checks
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }
        if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
            return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
        }

        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /leads/:id
 */
export const updateLead = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    if (!isValidUUID(id)) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    try {
        const leadRes = await query('SELECT id, vertical_id, is_deleted, assigned_to FROM leads WHERE id = $1', [id]);
        const lead    = leadRes.rows[0];
        if (!lead || lead.is_deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }
        if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
            return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
        }

        const fields = [
            'name', 'phone', 'business_name', 'status', 'sub_vertical_id', 'assigned_to',
            'lead_type', 'geotag_lat', 'geotag_lng', 'geotag_accuracy',
            'geotag_photo_key', 'geotag_address', 'geotag_captured_at', 'stage_id'
        ];
        const setClauses = [];
        const params     = [id];
        let   pIdx       = 2;

        fields.forEach(f => {
            const camelF = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            if (updates[camelF] !== undefined) {
                setClauses.push(`${f} = $${pIdx++}`);
                let val = updates[camelF];
                if (f === 'geotag_lat' || f === 'geotag_lng' || f === 'geotag_accuracy') {
                    val = val !== '' && val !== null ? parseFloat(val) : null;
                } else if (f === 'geotag_captured_at') {
                    val = val !== '' && val !== null ? new Date(val) : null;
                } else if (f === 'stage_id') {
                    val = val !== '' && val !== null && isValidUUID(val) ? val : null;
                }
                params.push(val);
            }
        });

        if (updates.data) {
            // Merge JSONB — keeps existing keys, overwrites provided ones
            setClauses.push(`data = data || $${pIdx++}`);
            params.push(JSON.stringify(updates.data));
        }

        // Process Custom Fields values if updates.customValues is provided
        if (updates.customValues) {
            const subVerticalId = updates.subVerticalId !== undefined ? updates.subVerticalId : lead.sub_vertical_id;
            
            if (subVerticalId) {
                const customFieldsRes = await query(
                    'SELECT id, field_key, is_required, validation_regex, validation_message FROM custom_fields WHERE sub_vertical_id = $1 AND is_active = true',
                    [subVerticalId]
                );
                
                const insertPromises = [];
                for (const field of customFieldsRes.rows) {
                    const val = updates.customValues[field.field_key];
                    
                    if (field.is_required && (val === null || val === '')) {
                        return res.status(400).json({ success: false, error: `Custom field '${field.field_key}' is required` });
                    }
                    
                    if (val !== undefined && val !== null && val !== '') {
                        if (field.validation_regex) {
                            try {
                                const rx = new RegExp(field.validation_regex);
                                if (!rx.test(val.toString())) {
                                    return res.status(400).json({ success: false, error: field.validation_message || `Invalid format for '${field.field_key}'` });
                                }
                            } catch (e) {
                                if (e.message.includes('Invalid format')) {
                                    return res.status(400).json({ success: false, error: e.message });
                                }
                            }
                        }
                        
                        const valId = crypto.randomUUID();
                        insertPromises.push(
                            query(`
                                INSERT INTO lead_custom_values (id, lead_id, custom_field_id, value)
                                VALUES ($1, $2, $3, $4)
                                ON CONFLICT (lead_id, custom_field_id) DO UPDATE SET value = EXCLUDED.value
                            `, [valId, id, field.id, String(val)])
                        );
                    }
                }
                if (insertPromises.length > 0) {
                    await Promise.all(insertPromises);
                }
            }
        }

        if (setClauses.length === 0) {
            const fullRes = await query('SELECT * FROM leads WHERE id = $1', [id]);
            return res.status(200).json({ success: true, data: fullRes.rows[0] });
        }

        const updatedRes = await query(
            `UPDATE leads SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            params
        );
        const updatedLead = updatedRes.rows[0];

        // Surgical cache invalidation
        await invalidateOnLeadChange(lead.vertical_id, id);

        logAudit(req, { action: 'lead.update', targetCollection: 'leads', targetId: id, after: updatedLead });

        broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'update', leadId: id });

        return res.status(200).json({ success: true, data: updatedLead });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};


/**
 * DELETE /leads/:id (soft-delete)
 */
export const deleteLead = async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    try {
        const leadRes = await query('SELECT id, vertical_id, assigned_to, is_deleted FROM leads WHERE id = $1', [id]);
        const lead    = leadRes.rows[0];
        if (!lead || lead.is_deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }
        if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
            return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
        }

        await query('UPDATE leads SET is_deleted = true, deleted_at = NOW(), deleted_by = $1 WHERE id = $2', [req.user.sub, id]);

        await invalidateOnLeadChange(lead.vertical_id, id);

        logAudit(req, { action: 'lead.delete', targetCollection: 'leads', targetId: id });

        broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'delete', leadId: id });

        return res.status(200).json({ success: true, data: { message: 'Lead soft-deleted successfully' } });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /leads/:id/status
 */
export const updateLeadStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!isValidUUID(id)) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    try {
        const leadRes = await query('SELECT id, vertical_id, assigned_to, is_deleted FROM leads WHERE id = $1', [id]);
        const lead    = leadRes.rows[0];
        if (!lead || lead.is_deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }
        if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
            return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
        }

        const updatedRes = await query(
            'UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        await invalidateOnLeadChange(lead.vertical_id, id);

        logAudit(req, { action: 'lead.status_update', targetCollection: 'leads', targetId: id, after: { status } });

        broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'status_update', leadId: id });

        return res.status(200).json({ success: true, data: updatedRes.rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /leads/:id/assign
 */
export const assignLead = async (req, res) => {
    const { id }     = req.params;
    const { userId } = req.body;
    if (!isValidUUID(id)) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    try {
        const leadRes = await query('SELECT id, vertical_id, is_deleted FROM leads WHERE id = $1', [id]);
        const lead    = leadRes.rows[0];
        if (!lead || lead.is_deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const updatedRes = await query(
            'UPDATE leads SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [userId || null, id]
        );

        await invalidateOnLeadChange(lead.vertical_id, id);

        logAudit(req, { action: 'lead.assign', targetCollection: 'leads', targetId: id, after: { assignedTo: userId } });

        broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'assign', leadId: id });

        return res.status(200).json({ success: true, data: updatedRes.rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /leads/export/csv
 *
 * Uses explicit column projection — avoids returning internal fields like
 * is_deleted, deleted_at, search_vector in exports.
 */
export const exportLeadsCsv = async (req, res) => {
    const { verticalId } = req.query;
    if (!isValidUUID(verticalId)) {
        return res.status(400).json({ success: false, error: 'Invalid vertical ID format' });
    }
    try {
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        // Explicit projection: only export-relevant fields
        const leadsRes = await query(`
            SELECT
                l.id, l.name, l.phone, l.business_name,
                l.status, l.source, l.created_at,
                u.name  AS assignee_name,
                sv.name AS sub_vertical_name
            FROM leads l
            LEFT JOIN users         u  ON u.id  = l.assigned_to
            LEFT JOIN sub_verticals sv ON sv.id = l.sub_vertical_id
            WHERE l.vertical_id = $1 AND l.is_deleted = false
            ORDER BY l.created_at DESC
        `, [verticalId]);

        const leads     = leadsRes.rows;
        const csvHeader = 'ID,Name,Phone,Business Name,Status,Sub-Vertical,Employee Spoken,Source,Created At\n';
        const csvRows   = leads.map(l =>
            `"${l.id}","${l.name}","${l.phone}","${l.business_name}","${l.status}","${l.sub_vertical_name || ''}","${l.assignee_name || ''}","${l.source}","${l.created_at.toISOString()}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=leads-export-${Date.now()}.csv`);
        return res.status(200).send(csvHeader + csvRows);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const uploadLeadPhoto = async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    try {
        const leadRes = await query('SELECT id, vertical_id, is_deleted, assigned_to FROM leads WHERE id = $1', [id]);
        const lead = leadRes.rows[0];
        if (!lead || lead.is_deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(lead.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }
        if (req.user.role === 'agent' && lead.assigned_to !== req.user.sub) {
            return res.status(403).json({ success: false, error: 'Access forbidden: this lead is not assigned to you' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const uploadsDir = path.join(__dirname, '../../../uploads');

        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = path.extname(req.file.originalname) || '.jpg';
        const filename = `${id}-${Date.now()}${ext}`;
        const filepath = path.join(uploadsDir, filename);

        fs.writeFileSync(filepath, req.file.buffer);

        const photoKey = `/uploads/${filename}`;

        // Update lead geotag photo key
        const updatedRes = await query(
            'UPDATE leads SET geotag_photo_key = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [photoKey, id]
        );

        await invalidateOnLeadChange(lead.vertical_id, id);
        broadcastToAll({ type: 'LEAD_MUTATED', verticalId: lead.vertical_id, action: 'update', leadId: id });
        logAudit(req, { action: 'lead.upload_photo', targetCollection: 'leads', targetId: id, after: { geotagPhotoKey: photoKey } });

        return res.status(200).json({ success: true, data: updatedRes.rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /leads/bulk
 */
export const createLeadBulk = async (req, res) => {
    const { leads, verticalId } = req.body;

    if (!verticalId || !isValidUUID(verticalId)) {
        return res.status(400).json({ success: false, error: 'Invalid vertical ID format' });
    }

    if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ success: false, error: 'leads must be a non-empty array' });
    }

    if (leads.length > 10000) {
        return res.status(400).json({ success: false, error: 'Maximum 10,000 leads per request' });
    }

    try {
        // RBAC check
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const LeadSchema = z.object({
            name: z.string().min(1, 'Name is required').max(255),
            phone: z.string().optional().nullable().transform(val => val || ''),
            businessName: z.string().optional().nullable().transform(val => val || ''),
            subVerticalId: z.string().uuid().optional().nullable(),
            assignedTo: z.string().uuid().optional().nullable(),
            leadType: z.enum(['CALL', 'FIELD']).default('CALL'),
            status: z.string().default('new'),
            data: z.record(z.any()).optional().default({}),
            stageId: z.string().uuid().optional().nullable(),
        });

        const valid = [];
        const invalid = [];

        for (let i = 0; i < leads.length; i++) {
            const result = LeadSchema.safeParse(leads[i]);
            if (result.success) {
                valid.push(result.data);
            } else {
                invalid.push({ index: i, errors: result.error.flatten().fieldErrors });
            }
        }

        if (valid.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    inserted: 0,
                    skipped: leads.length,
                    errors: invalid
                }
            });
        }

        // Deduplication against DB: fetch existing phone numbers for this vertical
        const inputPhones = valid.map(l => l.phone).filter(Boolean);
        let existingPhones = [];
        if (inputPhones.length > 0) {
            const existingRes = await query(
                'SELECT phone FROM leads WHERE vertical_id = $1 AND is_deleted = false AND phone = ANY($2)',
                [verticalId, inputPhones]
            );
            existingPhones = existingRes.rows.map(r => r.phone);
        }
        const phoneSet = new Set(existingPhones);

        const finalInsertLeads = [];

        for (const lead of valid) {
            if (lead.phone && phoneSet.has(lead.phone)) {
                invalid.push({ name: lead.name, phone: lead.phone, reason: 'Duplicate phone number' });
            } else {
                finalInsertLeads.push(lead);
                if (lead.phone) {
                    phoneSet.add(lead.phone); // Prevent duplicate phones within the same batch
                }
            }
        }

        let insertedCount = 0;
        let insertedRows = [];
        if (finalInsertLeads.length > 0) {
            const columns = [
                'id', 'vertical_id', 'sub_vertical_id', 'assigned_to', 'uploaded_by',
                'name', 'phone', 'business_name', 'data', 'status', 'lead_type', 'stage_id'
            ];
            const rows = finalInsertLeads.map(l => [
                crypto.randomUUID(),
                verticalId,
                l.subVerticalId || null,
                l.assignedTo || null,
                req.user.sub,
                l.name,
                l.phone || '',
                l.businessName || '',
                JSON.stringify(l.data || {}),
                l.status || 'new',
                l.leadType || 'CALL',
                l.stageId || null
            ]);

            insertedRows = await bulkInsert(
                { query },
                'leads',
                columns,
                rows,
                { onConflict: 'ON CONFLICT DO NOTHING' }
            );
            insertedCount = insertedRows.length;
        }

        // Invalidate lead list cache for this vertical
        await invalidateOnLeadChange(verticalId, null);
        broadcastToAll({ type: 'LEAD_MUTATED', verticalId, action: 'bulk_create' });

        return res.status(200).json({
            success: true,
            data: {
                inserted: insertedCount,
                skipped: leads.length - insertedCount,
                errors: invalid
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};


