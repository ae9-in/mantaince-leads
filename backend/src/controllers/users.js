import User from '../models/user.js';
import Role from '../models/role.js';
import { logAudit } from '../utils/audit.js';

// Get list of users (scoped by role)
export const getUsers = async (req, res) => {
  try {
    const { roleName, verticalAccess } = req.user;
    let query = {};

    // Vertical admin only sees users sharing access to their verticals
    if (roleName !== 'super_admin') {
      query = { 
        verticalAccess: { $in: verticalAccess }
      };
    }

    const users = await User.find(query)
      .populate('roleId', 'name permissions')
      .populate('verticalAccess', 'name')
      .sort({ name: 1 });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create / Invite a new User
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, verticalAccess } = req.body;
    const { roleName: actorRole, verticalAccess: actorVerticals, userId: actorId } = req.user;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    // Role verification
    const targetRole = await Role.findOne({ name: role });
    if (!targetRole) {
      return res.status(400).json({ message: `Role "${role}" does not exist` });
    }

    // RBAC check: Vertical Admin can't create Super Admin
    if (actorRole !== 'super_admin') {
      if (role === 'super_admin') {
        return res.status(403).json({ message: 'Access forbidden: cannot create a Super Admin' });
      }
      
      // Vertical Admin can only assign vertical access they themselves possess
      const targetVerticals = verticalAccess || [];
      const hasAllAccess = targetVerticals.every(vId => actorVerticals.includes(vId.toString()));
      if (!hasAllAccess) {
        return res.status(403).json({ message: 'Access forbidden: you cannot assign access to verticals you do not manage' });
      }
    }

    // Check email uniqueness
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: `User with email "${email}" already exists` });
    }

    const newUser = await User.create({
      name,
      email,
      passwordHash: password, // Pre-save hook will hash it automatically
      roleId: targetRole._id,
      verticalAccess: verticalAccess || [],
      createdBy: actorId,
      isActive: true
    });

    await logAudit(actorId, 'user.create', 'users', newUser._id, { name, email, role, verticalAccess }, req);

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: role,
      verticalAccess: newUser.verticalAccess,
      isActive: newUser.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an existing User
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, verticalAccess, isActive } = req.body;
    const { roleName: actorRole, verticalAccess: actorVerticals, userId: actorId } = req.user;

    const user = await User.findById(id).populate('roleId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const original = user.toObject();

    // Verification of permissions
    if (actorRole !== 'super_admin') {
      // Check if user to update shares access to vertical admin verticals
      const hasAccess = user.verticalAccess.some(v => actorVerticals.includes(v.toString()));
      if (!hasAccess && user.verticalAccess.length > 0) {
        return res.status(403).json({ message: 'Access forbidden: you do not have permission to update this user' });
      }

      // Vertical admin cannot change role to super_admin
      if (role && role === 'super_admin') {
        return res.status(403).json({ message: 'Access forbidden: cannot change role to Super Admin' });
      }

      // Vertical admin cannot assign vertical access they do not possess
      if (verticalAccess) {
        const hasAllAccess = verticalAccess.every(vId => actorVerticals.includes(vId.toString()));
        if (!hasAllAccess) {
          return res.status(403).json({ message: 'Access forbidden: you cannot assign access to verticals you do not manage' });
        }
      }
    }

    // Perform updates
    if (name) user.name = name;
    
    if (role) {
      const targetRole = await Role.findOne({ name: role });
      if (!targetRole) {
        return res.status(400).json({ message: `Role "${role}" does not exist` });
      }
      user.roleId = targetRole._id;
    }

    if (verticalAccess) {
      user.verticalAccess = verticalAccess;
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    await user.save();

    await logAudit(actorId, 'user.update', 'users', user._id, { before: original, after: user }, req);

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: role || user.roleId.name,
      verticalAccess: user.verticalAccess,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle active status
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const { roleName: actorRole, verticalAccess: actorVerticals, userId: actorId } = req.user;

    if (isActive === undefined) {
      return res.status(400).json({ message: 'isActive field is required' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify access
    if (actorRole !== 'super_admin') {
      const hasAccess = user.verticalAccess.some(v => actorVerticals.includes(v.toString()));
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access forbidden: you do not have access to toggle this user' });
      }
    }

    const originalActive = user.isActive;
    user.isActive = isActive;
    await user.save();

    await logAudit(actorId, 'user.toggle_status', 'users', user._id, { before: originalActive, after: isActive }, req);

    res.status(200).json({ id: user._id, isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
