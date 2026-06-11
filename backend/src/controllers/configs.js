import FieldConfig from '../models/fieldConfig.js';
import { logAudit } from '../utils/audit.js';

// Get field configurations for a vertical
export const getFieldConfigs = async (req, res) => {
  try {
    const { verticalId } = req.params;
    const { roleName, verticalAccess } = req.user;

    // Check access to the vertical
    if (roleName !== 'super_admin' && !verticalAccess.includes(verticalId)) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const configs = await FieldConfig.find({ verticalId }).sort({ displayOrder: 1, label: 1 });
    res.status(200).json(configs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create or update a field configuration (Super Admin / Vertical Admin)
export const createOrUpdateFieldConfig = async (req, res) => {
  try {
    const { verticalId } = req.params;
    const { fieldKey, label, fieldType, options, isRequired, isCsvMapped, csvHeader, displayOrder, isVisible, id } = req.body;
    const { roleName, verticalAccess } = req.user;

    // Verify user role
    if (roleName !== 'super_admin' && roleName !== 'vertical_admin') {
      return res.status(403).json({ message: 'Access forbidden: only admins can manage field configurations' });
    }

    // Check vertical access
    if (roleName !== 'super_admin' && !verticalAccess.includes(verticalId)) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    if (!fieldKey || !label || !fieldType) {
      return res.status(400).json({ message: 'fieldKey, label, and fieldType are required' });
    }

    const normalizedKey = fieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    let config;
    if (id) {
      // Update existing
      config = await FieldConfig.findById(id);
      if (!config) {
        return res.status(404).json({ message: 'Field config not found' });
      }

      const original = config.toObject();

      config.label = label;
      config.fieldType = fieldType;
      config.options = options || [];
      config.isRequired = !!isRequired;
      config.isCsvMapped = !!isCsvMapped;
      config.csvHeader = csvHeader || '';
      config.displayOrder = displayOrder || 0;
      config.isVisible = isVisible !== undefined ? !!isVisible : true;

      await config.save();

      await logAudit(req.user.userId, 'field_config.update', 'fieldconfigs', config._id, { before: original, after: config }, req);
    } else {
      // Create new
      // Check for duplicate key in same vertical
      const existing = await FieldConfig.findOne({ verticalId, fieldKey: normalizedKey });
      if (existing) {
        return res.status(400).json({ message: `Field key "${normalizedKey}" already exists in this vertical` });
      }

      config = await FieldConfig.create({
        verticalId,
        fieldKey: normalizedKey,
        label,
        fieldType,
        options: options || [],
        isRequired: !!isRequired,
        isCsvMapped: !!isCsvMapped,
        csvHeader: csvHeader || '',
        displayOrder: displayOrder || 0,
        isVisible: isVisible !== undefined ? !!isVisible : true
      });

      await logAudit(req.user.userId, 'field_config.create', 'fieldconfigs', config._id, config, req);
    }

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a field configuration (Super Admin / Vertical Admin)
export const deleteFieldConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, verticalAccess } = req.user;

    // Verify user role
    if (roleName !== 'super_admin' && roleName !== 'vertical_admin') {
      return res.status(403).json({ message: 'Access forbidden: only admins can manage field configurations' });
    }

    const config = await FieldConfig.findById(id);
    if (!config) {
      return res.status(404).json({ message: 'Field configuration not found' });
    }

    // Check vertical access
    if (roleName !== 'super_admin' && !verticalAccess.includes(config.verticalId.toString())) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const original = config.toObject();
    await FieldConfig.deleteOne({ _id: id });

    await logAudit(req.user.userId, 'field_config.delete', 'fieldconfigs', id, original, req);

    res.status(200).json({ message: 'Field configuration deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
