import { query } from '../config/db.js';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';
import { cacheGet } from '../services/cache.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const isPositive = req.query.leadType === 'POSITIVE';

    const baseHeaders = isPositive ? [
      'DATE',
      'EMPLOYEE NAME',
      'BUSINESS TYPE',
      'BUSINESS / PERSON / SHOP / COMPANY NAME',
      'AREA',
      'CITY',
      'CONTACT NUMBER',
      'POINT OF CONTACT',
      'REMARKS',
      'RECORDINGS',
      'FOLLOW-UP REQUIRED',
      'FOLLOW-UPS',
      'FOLLOW-UP DATES',
      'FOLLOW-UP REMARKS',
      'REQUIREMENT IF ANY',
      'A NOTES TO THE COS TEAM ONLY'
    ] : [
      'DATE',
      'EMPLOYEE NAME',
      'BUSINESS TYPE',
      'BUSINESS / PERSON / SHOP / COMPANY NAME',
      'CONTACT NUMBER',
      'POINT OF CONTACT',
      'AREA',
      'CITY',
      'LINK ADDRESS',
      'REMARKS',
      'RECORDINGS',
      'APPOINTMENT TYPE (YES OR NO)',
      'APPOINTMENT DATE',
      'APPOINTMENT TIME',
      'REQUIREMENT ORDER IF ANY',
      'NOTES TO THE COS IF ANY'
    ];

    const customHeaders = configs.map(c => c.csv_header || c.label);
    const headers = [...baseHeaders, ...customHeaders];

    const csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

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
  const { verticalId, assignedTo, subVerticalId, leadType = 'CALL' } = req.body;
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
    const fileName = `${logId}.csv`;
    const uploadPath = path.join(__dirname, '../../uploads', fileName);
    const uploadDir = path.dirname(uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save uploaded file buffer to disk
    fs.writeFileSync(uploadPath, file.buffer);

    const logRes = await query(`
      INSERT INTO csv_upload_logs (id, uploaded_by, vertical_id, file_name, original_file_name, status, sub_vertical_id, assigned_to, lead_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [logId, req.user.sub, verticalId, fileName, file.originalname, 'queued', subVerticalId, targetAssignedTo || null, leadType]);

    const uploadLog = logRes.rows[0];

    await logAudit(req, {
      action: 'csv.upload_queued',
      targetCollection: 'csv_upload_logs',
      targetId: uploadLog.id,
      after: { originalFileName: file.originalname, status: 'queued', file_name: fileName }
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

    let csvContent = '';
    const firstError = errors.find(e => e.originalRow && typeof e.originalRow === 'object');
    if (firstError) {
      const originalHeaders = Object.keys(firstError.originalRow);
      const csvHeader = [...originalHeaders, 'ERROR REASON'].map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
      const csvRows = errors.map(e => {
        const rowData = e.originalRow || {};
        const values = originalHeaders.map(h => {
          const val = rowData[h] === undefined || rowData[h] === null ? '' : rowData[h].toString();
          return `"${val.replace(/"/g, '""')}"`;
        });
        values.push(`"${(e.reason || '').replace(/"/g, '""')}"`);
        return values.join(',');
      }).join('\n');
      csvContent = csvHeader + csvRows + '\n';
    } else {
      const csvHeader = 'Row,Reason\n';
      const csvRows = errors.map(e => `"${e.row}","${(e.reason || '').replace(/"/g, '""')}"`).join('\n');
      csvContent = csvHeader + csvRows + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=error-report-${batchId}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
