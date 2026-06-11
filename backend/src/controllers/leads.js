import Lead from '../models/lead.js';
import FieldConfig from '../models/fieldConfig.js';
import CsvUploadLog from '../models/csvUploadLog.js';
import User from '../models/user.js';
import { logAudit } from '../utils/audit.js';
import { csvQueue } from '../workers/csvWorker.js';

const BASE_DYNAMIC_FIELDS = [
  { key: 'nameBusiness', label: 'Name Business', fieldType: 'text' },
  { key: 'date', label: 'Date', fieldType: 'date' },
  { key: 'employeeSpoken', label: 'Employee Spoken', fieldType: 'text' },
  { key: 'convertedStatus', label: 'Converted Status', fieldType: 'text' },
  { key: 'deliveredLocation', label: 'Delivered Location', fieldType: 'text' },
  { key: 'deliveredLink', label: 'Delivered Link', fieldType: 'url' }
];

const BASE_DYNAMIC_FIELD_MAP = new Map(
  BASE_DYNAMIC_FIELDS.map((field) => [field.key, field])
);

const normalizeBaseFieldValue = (fieldType, value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (fieldType === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return String(value).trim();
};

const getMergedFieldDefinitions = async (verticalId) => {
  const configs = await FieldConfig.find({ verticalId });
  const configKeys = new Set(configs.map((config) => config.fieldKey));
  const merged = [...configs];

  BASE_DYNAMIC_FIELDS.forEach((field) => {
    if (!configKeys.has(field.key)) {
      merged.push({
        fieldKey: field.key,
        label: field.label,
        fieldType: field.fieldType,
        isRequired: false,
        options: [],
      });
    }
  });

  return merged;
};

// Helper to validate and coerce custom lead data against FieldConfig
const validateLeadData = async (verticalId, dataMap) => {
  const configs = await getMergedFieldDefinitions(verticalId);
  const validatedData = {};
  const errors = [];

  for (const config of configs) {
    const key = config.fieldKey;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const value = dataMap && typeof dataMap === 'object' ? dataMap[key] : undefined;

    // Check required fields
    if (config.isRequired && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${config.label}" is required.`);
      continue;
    }

    if (value !== undefined && value !== null && value !== '') {
      // Coerce based on fieldType
      if (BASE_DYNAMIC_FIELD_MAP.has(key)) {
        const normalized = normalizeBaseFieldValue(config.fieldType, value);
        if (normalized === undefined && value !== undefined && value !== null && value !== '') {
          errors.push(`Field "${config.label}" must be a valid ${config.fieldType}.`);
        } else if (normalized !== undefined) {
          validatedData[key] = normalized;
        }
      } else if (config.fieldType === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`Field "${config.label}" must be a number.`);
        } else {
          validatedData[key] = num;
        }
      } else if (config.fieldType === 'boolean') {
        validatedData[key] = value === true || value === 'true' || value === 1 || value === '1';
      } else if (config.fieldType === 'date') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`Field "${config.label}" must be a valid date.`);
        } else {
          validatedData[key] = date;
        }
      } else if (config.fieldType === 'select') {
        if (!config.options.includes(value)) {
          errors.push(`Field "${config.label}" must be one of: ${config.options.join(', ')}.`);
        } else {
          validatedData[key] = value;
        }
      } else {
        // default text, textarea, url
        validatedData[key] = String(value).trim();
      }
    }
  }

  return { validatedData, errors };
};

// Get Leads with filtering, pagination, and text search
export const getLeads = async (req, res) => {
  try {
    const { verticalId, subVerticalId, status, assignedTo, q, page = 1, limit = 25 } = req.query;
    
    // Build filter query
    // req.scopeFilter contains role restrictions (verticalId or assignedTo limitations) injected by injectScope
    const filter = { ...req.scopeFilter };

    if (verticalId) {
      // Check that the user has access to this vertical
      if (req.user.roleName !== 'super_admin' && !req.user.verticalAccess.includes(verticalId.toString())) {
        return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
      }
      filter.verticalId = verticalId;
    }

    if (subVerticalId) {
      filter.subVerticalId = subVerticalId;
    }

    if (status) {
      filter.status = status;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    // Filter by dynamic custom fields in query params
    const activeVertId = verticalId || filter.verticalId;
    if (activeVertId) {
      const configs = await getMergedFieldDefinitions(activeVertId);
      configs.forEach(config => {
        const val = req.query[config.fieldKey];
        if (val !== undefined && val !== null && val !== '') {
          if (config.fieldType === 'boolean') {
            filter[`data.${config.fieldKey}`] = val === 'true' || val === true;
          } else if (config.fieldType === 'number') {
            filter[`data.${config.fieldKey}`] = Number(val);
          } else {
            filter[`data.${config.fieldKey}`] = val;
          }
        }
      });
    }

    // Substring Search across name, businessName, and area
    if (q) {
      const escapedQ = q.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedQ, $options: 'i' } },
        { businessName: { $regex: escapedQ, $options: 'i' } },
        { 'data.nameBusiness': { $regex: escapedQ, $options: 'i' } },
        { 'data.area': { $regex: escapedQ, $options: 'i' } }
      ];
    }

    // Pagination setup
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('verticalId', 'name')
        .populate('subVerticalId', 'name')
        .populate('assignedTo', 'name email')
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Lead.countDocuments(filter)
    ]);

    res.status(200).json({
      leads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single lead details
export const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // We populate first, then verify user has access to this vertical
    const lead = await Lead.findById(id)
      .populate('verticalId', 'name')
      .populate('subVerticalId', 'name')
      .populate('assignedTo', 'name email')
      .populate('uploadedBy', 'name');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Verify vertical access
    const { roleName, verticalAccess, userId } = req.user;
    if (roleName !== 'super_admin') {
      if (!verticalAccess.includes(lead.verticalId._id.toString())) {
        return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
      }
      if (roleName === 'agent' && lead.assignedTo?.toString() !== userId) {
        return res.status(403).json({ message: 'Access forbidden: you are not assigned to this lead' });
      }
    }

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a Lead (manual entry)
export const createLead = async (req, res) => {
  try {
    const { verticalId, subVerticalId, assignedTo, name, phone, businessName, status, data } = req.body;

    if (!verticalId || !name) {
      return res.status(400).json({ message: 'Name and Vertical ID are required' });
    }

    // Validate phone formatting/presence and check for duplicate phone inside the vertical
    if (phone) {
      const existing = await Lead.findOne({ verticalId, phone });
      if (existing) {
        return res.status(400).json({ message: `A lead with phone number "${phone}" already exists in this vertical` });
      }
    }

    // Validate dynamic field configurations
    const dataMap = data || {};
    const { validatedData, errors } = await validateLeadData(verticalId, dataMap);

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const lead = await Lead.create({
      verticalId,
      subVerticalId: subVerticalId || undefined,
      assignedTo: assignedTo || undefined,
      uploadedBy: req.user.userId,
      name,
      phone: phone || undefined,
      businessName: businessName || undefined,
      data: validatedData,
      status: status || 'new',
      source: 'manual'
    });

    await logAudit(req.user.userId, 'lead.create', 'leads', lead._id, lead, req);

    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a Lead
export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { subVerticalId, assignedTo, name, phone, businessName, status, data } = req.body;
    const { roleName, verticalAccess, userId } = req.user;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Verify vertical access
    if (roleName !== 'super_admin') {
      if (!verticalAccess.includes(lead.verticalId.toString())) {
        return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
      }
      if (roleName === 'agent' && lead.assignedTo?.toString() !== userId) {
        return res.status(403).json({ message: 'Access forbidden: you are not assigned to this lead' });
      }
    }

    const original = lead.toObject();

    // Verify phone duplicate inside vertical
    if (phone && phone !== lead.phone) {
      const existing = await Lead.findOne({ verticalId: lead.verticalId, phone });
      if (existing) {
        return res.status(400).json({ message: `A lead with phone number "${phone}" already exists in this vertical` });
      }
      lead.phone = phone;
    } else if (phone === '') {
      lead.phone = undefined;
    }

    if (name) lead.name = name;
    if (businessName !== undefined) lead.businessName = businessName || undefined;
    if (status) lead.status = status;
    if (subVerticalId !== undefined) lead.subVerticalId = subVerticalId || undefined;

    // Admin / Super Admin can change assignments
    if (roleName === 'super_admin' || roleName === 'vertical_admin') {
      if (assignedTo !== undefined) lead.assignedTo = assignedTo || undefined;
    }

    // Validate and merge dynamic custom data
    if (data) {
      const mergedData = { ...lead.data.toJSON(), ...data };
      const { validatedData, errors } = await validateLeadData(lead.verticalId, mergedData);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }
      lead.data = validatedData;
    }

    await lead.save();

    await logAudit(req.user.userId, 'lead.update', 'leads', lead._id, { before: original, after: lead }, req);

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a Lead
export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, verticalAccess } = req.user;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check vertical access
    if (roleName !== 'super_admin' && !verticalAccess.includes(lead.verticalId.toString())) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const original = lead.toObject();
    await Lead.deleteOne({ _id: id });

    await logAudit(req.user.userId, 'lead.delete', 'leads', id, original, req);

    res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Import CSV File
export const importCsv = async (req, res) => {
  try {
    const { verticalId } = req.body;
    if (!verticalId) {
      return res.status(400).json({ message: 'Vertical ID is required' });
    }

    // Check vertical access
    const { roleName, verticalAccess, userId } = req.user;
    if (roleName !== 'super_admin' && !verticalAccess.includes(verticalId.toString())) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    // Create CsvUploadLog entry in processing status
    const log = await CsvUploadLog.create({
      uploadedBy: userId,
      verticalId,
      fileName: req.file.originalname,
      status: 'processing'
    });

    // Enqueue CSV worker processing job
    csvQueue.enqueue({
      filePath: req.file.path,
      verticalId,
      uploadedBy: userId,
      logId: log._id
    });

    res.status(202).json({
      message: 'CSV file uploaded and is being processed in the background',
      logId: log._id,
      fileName: log.fileName,
      status: log.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get CSV upload history logs for a vertical
export const getCsvLogs = async (req, res) => {
  try {
    const { verticalId } = req.query;
    if (!verticalId) {
      return res.status(400).json({ message: 'Vertical ID is required' });
    }

    const { roleName, verticalAccess } = req.user;
    if (roleName !== 'super_admin' && !verticalAccess.includes(verticalId.toString())) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const logs = await CsvUploadLog.find({ verticalId })
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export Leads to CSV
export const exportLeads = async (req, res) => {
  try {
    const { verticalId, subVerticalId, status, assignedTo, q } = req.query;

    const filter = { ...req.scopeFilter };

    if (verticalId) {
      if (req.user.roleName !== 'super_admin' && !req.user.verticalAccess.includes(verticalId.toString())) {
        return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
      }
      filter.verticalId = verticalId;
    } else {
      return res.status(400).json({ message: 'Vertical ID is required for exporting leads' });
    }

    if (subVerticalId) filter.subVerticalId = subVerticalId;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (q) {
      const escapedQ = q.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedQ, $options: 'i' } },
        { businessName: { $regex: escapedQ, $options: 'i' } },
        { 'data.nameBusiness': { $regex: escapedQ, $options: 'i' } },
        { 'data.area': { $regex: escapedQ, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(filter)
      .populate('subVerticalId', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    const configs = await getMergedFieldDefinitions(filter.verticalId);

    // Set Response Headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads-export-${Date.now()}.csv`);

    // Write Headers
    const headers = [
      'Name',
      'Number',
      'Business',
      'Name Business',
      'Date',
      'Employee Spoken',
      'Converted Status',
      'Delivered Location',
      'Delivered Link',
      'Status',
      'Sub-Vertical',
      'Assigned Agent'
    ];
    configs
      .filter((config) => !BASE_DYNAMIC_FIELD_MAP.has(config.fieldKey))
      .forEach(c => headers.push(c.label));

    let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

    // Write Rows
    leads.forEach(lead => {
      const row = [
        lead.name || '',
        lead.phone || '',
        lead.businessName || '',
        lead.data?.get?.('nameBusiness') || '',
        lead.data?.get?.('date') ? new Date(lead.data.get('date')).toISOString().split('T')[0] : '',
        lead.data?.get?.('employeeSpoken') || '',
        lead.data?.get?.('convertedStatus') || '',
        lead.data?.get?.('deliveredLocation') || '',
        lead.data?.get?.('deliveredLink') || '',
        lead.status || '',
        lead.subVerticalId?.name || '',
        lead.assignedTo?.name || ''
      ];

      // Dynamic custom fields
      configs
        .filter((config) => !BASE_DYNAMIC_FIELD_MAP.has(config.fieldKey))
        .forEach(c => {
        const val = lead.data.get(c.fieldKey);
        if (val === undefined || val === null) {
          row.push('');
        } else if (c.fieldType === 'date') {
          row.push(new Date(val).toISOString().split('T')[0]);
        } else {
          row.push(String(val));
        }
      });

      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
