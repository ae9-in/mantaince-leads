import { query } from '../config/db.js';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';
import { csvQueue } from '../jobs/queue.js';
import { cacheGet } from '../services/cache.js';

/**
 * GET /leads/csv/template/:verticalId
 */
export const downloadCsvTemplate = async (req, res) => {
  const { verticalId } = req.params;
  try {
    // Strict Vertical Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }

    const verticalRes = await query('SELECT * FROM verticals WHERE id = $1', [verticalId]);

    const vertical = verticalRes.rows[0];
    if (!vertical) {
      return res.status(404).json({ success: false, error: 'Vertical not found' });
    }

    const configsRes = await query('SELECT * FROM field_configs WHERE vertical_id = $1 AND is_csv_mapped = true ORDER BY display_order ASC', [verticalId]);
    const configs = configsRes.rows;

    const baseHeaders = [
      'Name',
      'Number',
      'Business',
      'Employee Spoken',
      'Lead Type',
      'Status',
      'Name Business',
      'Date',
      'Delivered Location (Google Maps Location)',
      'Delivered Link'
    ];

    const baseExample = [
      'John Doe',
      '+1234567890',
      'Acme Corp',
      'Jane Smith',
      'Calls',
      'New',
      'Acme Corp Office',
      '2026-06-22',
      'https://maps.google.com/?q=12.345,67.890',
      'https://example.com/delivered/report123'
    ];

    const customHeaders = configs.map(c => c.csv_header || c.label);
    const headers = [...baseHeaders, ...customHeaders];

    const customExamples = configs.map(c => {
      if (c.field_type === 'number') return '123';
      if (c.field_type === 'boolean') return 'True';
      if (c.field_type === 'date') return '2026-06-22';
      return 'Sample Value';
    });
    const exampleRow = [...baseExample, ...customExamples];

    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      exampleRow.map(v => `"${v.replace(/"/g, '""')}"`).join(',')
    ].join('\n') + '\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=template-${vertical.slug}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /leads/csv/upload
 */
export const uploadCsv = async (req, res) => {
  const { verticalId, assignedTo, subVerticalId } = req.body;
  const file = req.file;

  try {
    if (!file) return res.status(400).json({ success: false, error: 'CSV file is required' });
    if (!verticalId) return res.status(400).json({ success: false, error: 'verticalId is required' });
    if (!subVerticalId) return res.status(400).json({ success: false, error: 'Sub-vertical selection is mandatory for uploading leads.' });

    // Strict Vertical Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(verticalId))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }


    let targetAssignedTo = assignedTo;
    if (req.user.role === 'agent') {
      targetAssignedTo = req.user.sub;
    }

    const logId = crypto.randomUUID();
    const logRes = await query(`
      INSERT INTO csv_upload_logs (id, uploaded_by, vertical_id, original_file_name, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [logId, req.user.sub, verticalId, file.originalname, 'queued']);

    const uploadLog = logRes.rows[0];

    await csvQueue.add({
      batchId: uploadLog.id,
      fileBufferBase64: file.buffer.toString('base64'),
      originalFileName: file.originalname,
      verticalId,
      subVerticalId: subVerticalId || null,
      uploadedBy: req.user.sub,
      assignedTo: targetAssignedTo || null
    });

    await logAudit(req, {
      action: 'csv.upload_queued',
      targetCollection: 'csv_upload_logs',
      targetId: uploadLog.id,
      after: { originalFileName: file.originalname, status: 'queued' }
    });

    return res.status(202).json({
      success: true,
      data: {
        batchId: uploadLog.id,
        status: 'queued',
        message: 'File uploaded and queued for processing.'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /leads/csv/logs
 */
export const getCsvLogs = async (req, res) => {
  const { page = 1, limit = 15 } = req.query;
  try {
    let sql = 'SELECT l.*, v.name as vertical_name, u.name as user_name FROM csv_upload_logs l JOIN verticals v ON l.vertical_id = v.id JOIN users u ON l.uploaded_by = u.id';
    const params = [];
    if (req.user.role === 'vertical_admin') {
      sql += ' WHERE l.vertical_id = ANY($1)';
      params.push(req.user.verticalAccess);
    }

    const limitNum = parseInt(limit, 10);
    const offset = (parseInt(page, 10) - 1) * limitNum;
    sql += ` ORDER BY l.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const logsRes = await query(sql, params);
    return res.status(200).json({ success: true, data: logsRes.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /leads/csv/logs/:batchId
 */
export const getCsvLogById = async (req, res) => {
  const { batchId } = req.params;
  try {
    // Check cache first
    const cached = await cacheGet(`csv_progress:${batchId}`);
    if (cached) {
      // Strict Vertical Scoping check
      if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(cached.vertical_id))) {
        return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
      }
      return res.status(200).json({ success: true, data: cached });
    }

    const logRes = await query('SELECT * FROM csv_upload_logs WHERE id = $1', [batchId]);
    const log = logRes.rows[0];
    if (!log) return res.status(404).json({ success: false, error: 'CSV log not found' });

    // Strict Vertical Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(log.vertical_id))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }

    return res.status(200).json({ success: true, data: log });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /leads/csv/logs/:batchId/failed-rows
 */
export const streamFailedRows = async (req, res) => {
  const { batchId } = req.params;
  try {
    const logRes = await query('SELECT * FROM csv_upload_logs WHERE id = $1', [batchId]);
    const log = logRes.rows[0];
    if (!log) return res.status(404).json({ success: false, error: 'CSV log not found' });

    // Strict Vertical Scoping check
    if (req.user.role !== 'super_admin' && (!req.user.verticalAccess || !req.user.verticalAccess.includes(log.vertical_id))) {
      return res.status(403).json({ success: false, error: 'Access forbidden: you do not have access to this business vertical' });
    }

    const errors = log.errors || [];

    if (errors.length === 0) return res.status(400).json({ success: false, error: 'No errors found' });

    const csvHeader = 'Row,Reason\n';
    const csvRows = errors.map(e => `"${e.row}","${(e.reason || '').replace(/"/g, '""')}"`).join('\n');
    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=error-report-${batchId}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
