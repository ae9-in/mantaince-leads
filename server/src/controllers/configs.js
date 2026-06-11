import { query } from '../config/db.js';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';
import { isValidUUID } from '../utils/validators/index.js';
import {
    withCache, cacheDelete,
    invalidateOnTaxonomyChange
} from '../services/cache.js';
import { CacheKeys, TTL } from '../lib/cacheKeys.js';

/**
 * GET /verticals/:verticalId/fields
 * Cached in Redis for 24h per vertical.
 */
export const getFieldConfigs = async (req, res) => {
    const { verticalId } = req.params;
    if (!isValidUUID(verticalId)) {
        return res.status(200).json({ success: true, data: [] });
    }
    try {
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const configs = await withCache(CacheKeys.fieldConfigs(verticalId), TTL.FIELD_CONFIGS, async () => {
            const res2 = await query(
                'SELECT * FROM field_configs WHERE vertical_id = $1 ORDER BY display_order ASC',
                [verticalId]
            );
            return res2.rows;
        });

        return res.status(200).json({ success: true, data: configs });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /verticals/:verticalId/fields
 */
export const createFieldConfig = async (req, res) => {
    const { verticalId } = req.params;
    const fieldData      = req.body;
    if (!isValidUUID(verticalId)) {
        return res.status(400).json({ success: false, error: 'Invalid vertical ID format' });
    }
    try {
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const existsRes = await query(
            'SELECT id FROM field_configs WHERE vertical_id = $1 AND field_key = $2',
            [verticalId, fieldData.fieldKey]
        );
        if (existsRes.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'A field with this identifier key already exists in the vertical' });
        }

        const configId  = crypto.randomUUID();
        const configRes = await query(`
            INSERT INTO field_configs (
                id, vertical_id, field_key, label, field_type, options,
                is_required, is_csv_mapped, csv_header, display_order, is_visible
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            configId, verticalId, fieldData.fieldKey, fieldData.label, fieldData.fieldType,
            fieldData.options || [], fieldData.isRequired || false,
            fieldData.isCsvMapped || false, fieldData.csvHeader || '',
            fieldData.displayOrder || 0, fieldData.isVisible !== false
        ]);

        const config = configRes.rows[0];

        await invalidateOnTaxonomyChange(verticalId);

        logAudit(req, { action: 'field_config.create', targetCollection: 'field_configs', targetId: config.id, after: config });

        return res.status(201).json({ success: true, data: config });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /verticals/:verticalId/fields/:fieldId
 */
export const updateFieldConfig = async (req, res) => {
    const { fieldId } = req.params;
    const updates     = req.body;
    try {
        const configRes = await query('SELECT * FROM field_configs WHERE id = $1', [fieldId]);
        if (configRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Field configuration not found' });
        }

        const config = configRes.rows[0];

        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(config.vertical_id))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const before     = { ...config };
        const fields     = ['label', 'field_type', 'options', 'is_required', 'is_csv_mapped', 'csv_header', 'display_order', 'is_visible'];
        const setClauses = [];
        const params     = [fieldId];
        let   pIdx       = 2;

        fields.forEach(f => {
            const camelF = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            if (updates[camelF] !== undefined) {
                setClauses.push(`${f} = $${pIdx++}`);
                params.push(updates[camelF]);
            }
        });

        if (setClauses.length === 0) {
            return res.status(200).json({ success: true, data: config });
        }

        const updatedRes    = await query(
            `UPDATE field_configs SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            params
        );
        const updatedConfig = updatedRes.rows[0];

        await invalidateOnTaxonomyChange(config.vertical_id);

        logAudit(req, { action: 'field_config.update', targetCollection: 'field_configs', targetId: fieldId, before, after: updatedConfig });

        return res.status(200).json({ success: true, data: updatedConfig });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * DELETE /verticals/:verticalId/fields/:fieldId
 */
export const deleteFieldConfig = async (req, res) => {
    const { verticalId, fieldId } = req.params;
    if (!isValidUUID(verticalId) || !isValidUUID(fieldId)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }
    try {
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const configRes = await query('SELECT * FROM field_configs WHERE id = $1', [fieldId]);
        if (configRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Field configuration not found' });
        }

        const config   = configRes.rows[0];
        const fieldKey = config.field_key;

        // Check for existing lead data using this field key (JSONB key existence check)
        const leadRes = await query(`
            SELECT id FROM leads
            WHERE vertical_id = $1 AND is_deleted = false AND data ? $2
            LIMIT 1
        `, [verticalId, fieldKey]);

        if (leadRes.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: `Cannot delete field config. Dynamic key '${fieldKey}' already has active lead values recorded.`
            });
        }

        await query('DELETE FROM field_configs WHERE id = $1', [fieldId]);

        await invalidateOnTaxonomyChange(verticalId);

        logAudit(req, { action: 'field_config.delete', targetCollection: 'field_configs', targetId: fieldId, before: config });

        return res.status(200).json({ success: true, data: { message: 'Field configuration deleted successfully' } });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /verticals/:verticalId/fields/reorder
 * Single bulk UPDATE replaces serial for-loop.
 */
export const reorderFieldConfigs = async (req, res) => {
    const { verticalId } = req.params;
    const items          = req.body;
    if (!isValidUUID(verticalId)) {
        return res.status(400).json({ success: false, error: 'Invalid vertical ID format' });
    }
    try {
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(200).json({ success: true, data: { message: 'Field positions updated successfully' } });
        }

        const params = [];
        const tuples = items.map((item) => {
            params.push(item.id, item.displayOrder);
            return `($${params.length - 1}, $${params.length}::int)`;
        });

        await query(`
            UPDATE field_configs AS fc
            SET display_order = t.ord, updated_at = NOW()
            FROM (VALUES ${tuples.join(', ')}) AS t(id, ord)
            WHERE fc.id = t.id::uuid
        `, params);

        await invalidateOnTaxonomyChange(verticalId);

        return res.status(200).json({ success: true, data: { message: 'Field positions updated successfully' } });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /verticals/:verticalId/fields/csv-template
 * Served from the same Redis-cached field config list — no extra query.
 */
export const getCsvTemplateFields = async (req, res) => {
    const { verticalId } = req.params;
    if (!isValidUUID(verticalId)) {
        return res.status(200).json({ success: true, data: [] });
    }
    try {
        if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
            return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
        }

        const configs  = await withCache(CacheKeys.fieldConfigs(verticalId), TTL.FIELD_CONFIGS, async () => {
            const res2 = await query(
                'SELECT * FROM field_configs WHERE vertical_id = $1 ORDER BY display_order ASC',
                [verticalId]
            );
            return res2.rows;
        });

        const filtered = configs.filter(c => c.is_csv_mapped);
        return res.status(200).json({ success: true, data: filtered });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
