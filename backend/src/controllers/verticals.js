import Vertical from '../models/vertical.js';
import SubVertical from '../models/subVertical.js';
import { logAudit } from '../utils/audit.js';

// Helper to generate slug
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start
    .replace(/-+$/, ''); // Trim - from end
};

// Get all verticals (scoped by user access)
export const getVerticals = async (req, res) => {
  try {
    const { roleName, verticalAccess } = req.user;
    let query = {};

    // Non-super-admins only see verticals they have explicit access to
    if (roleName !== 'super_admin') {
      query = { _id: { $in: verticalAccess }, isActive: true };
    }

    const verticals = await Vertical.find(query).sort({ name: 1 });
    res.status(200).json(verticals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single vertical details
export const getVerticalById = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, verticalAccess } = req.user;

    if (roleName !== 'super_admin' && !verticalAccess.includes(id)) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const vertical = await Vertical.findById(id);
    if (!vertical) {
      return res.status(404).json({ message: 'Vertical not found' });
    }

    res.status(200).json(vertical);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a vertical (Super Admin only)
export const createVertical = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Vertical name is required' });
    }

    const slug = slugify(name);
    const existing = await Vertical.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: 'A vertical with a similar name or slug already exists' });
    }

    const vertical = await Vertical.create({
      name,
      slug,
      description,
      createdBy: req.user.userId
    });

    await logAudit(req.user.userId, 'vertical.create', 'verticals', vertical._id, vertical, req);

    res.status(201).json(vertical);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a vertical (Super Admin only)
export const updateVertical = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const vertical = await Vertical.findById(id);
    if (!vertical) {
      return res.status(404).json({ message: 'Vertical not found' });
    }

    const original = vertical.toObject();

    if (name) {
      vertical.name = name;
      vertical.slug = slugify(name);
    }
    if (description !== undefined) vertical.description = description;
    if (isActive !== undefined) vertical.isActive = isActive;

    await vertical.save();

    await logAudit(req.user.userId, 'vertical.update', 'verticals', vertical._id, { before: original, after: vertical }, req);

    res.status(200).json(vertical);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get sub-verticals for a vertical
export const getSubVerticals = async (req, res) => {
  try {
    const { verticalId } = req.params;
    const { roleName, verticalAccess } = req.user;

    if (roleName !== 'super_admin' && !verticalAccess.includes(verticalId)) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const subVerticals = await SubVertical.find({ verticalId }).sort({ name: 1 });
    res.status(200).json(subVerticals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create sub-vertical under a vertical (Super Admin / Vertical Admin)
export const createSubVertical = async (req, res) => {
  try {
    const { verticalId } = req.params;
    const { name } = req.body;
    const { roleName, verticalAccess } = req.user;

    if (roleName !== 'super_admin' && !verticalAccess.includes(verticalId)) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Sub-vertical name is required' });
    }

    const slug = slugify(name);

    // Check unique compound index (verticalId + slug)
    const existing = await SubVertical.findOne({ verticalId, slug });
    if (existing) {
      return res.status(400).json({ message: 'A sub-vertical with this name already exists in this vertical' });
    }

    const subVertical = await SubVertical.create({
      name,
      slug,
      verticalId,
      createdBy: req.user.userId
    });

    await logAudit(req.user.userId, 'sub_vertical.create', 'subverticals', subVertical._id, subVertical, req);

    res.status(201).json(subVertical);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update sub-vertical (Super Admin / Vertical Admin)
export const updateSubVertical = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const { roleName, verticalAccess } = req.user;

    const subVertical = await SubVertical.findById(id);
    if (!subVertical) {
      return res.status(404).json({ message: 'Sub-vertical not found' });
    }

    // Check vertical access
    if (roleName !== 'super_admin' && !verticalAccess.includes(subVertical.verticalId.toString())) {
      return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
    }

    const original = subVertical.toObject();

    if (name) {
      subVertical.name = name;
      subVertical.slug = slugify(name);

      // Verify no duplicate slug under the same vertical
      const existing = await SubVertical.findOne({
        verticalId: subVertical.verticalId,
        slug: subVertical.slug,
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({ message: 'A sub-vertical with this name already exists in this vertical' });
      }
    }

    if (isActive !== undefined) subVertical.isActive = isActive;

    await subVertical.save();

    await logAudit(req.user.userId, 'sub_vertical.update', 'subverticals', subVertical._id, { before: original, after: subVertical }, req);

    res.status(200).json(subVertical);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
