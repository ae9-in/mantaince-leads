import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { logAudit } from '../services/audit.js';

/**
 * GET /users
 */
export const getUsers = async (req, res) => {
  const { role, vertical, active } = req.query;
  try {
    let sql = `
      SELECT u.id, u.name, u.email, u.role_id, u.vertical_access,
             u.is_active, u.last_login_at, u.created_by, u.created_at, u.updated_at,
             r.name AS role_name
      FROM users u 
      JOIN roles r ON u.role_id = r.id
    `;
    const params = [];
    let whereClauses = [];
    let paramIndex = 1;

    if (req.user.role === 'vertical_admin') {
      whereClauses.push(`u.vertical_access && $${paramIndex++}`);
      params.push(req.user.verticalAccess);
    }

    if (role) {
      whereClauses.push(`r.name = $${paramIndex++}`);
      params.push(role);
    }
    if (vertical) {
      whereClauses.push(`$${paramIndex++} = ANY(u.vertical_access)`);
      params.push(vertical);
    }
    if (active !== undefined) {
      whereClauses.push(`u.is_active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    const usersRes = await query(sql, params);
    return res.status(200).json({ success: true, data: usersRes.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /users/invite
 */
export const inviteUser = async (req, res) => {
  const { name, email, role, password, verticalAccess = [] } = req.body;
  try {
    const existsRes = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existsRes.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const roleRes = await query('SELECT id FROM roles WHERE name = $1', [role]);
    const roleDoc = roleRes.rows[0];
    if (!roleDoc) {
      return res.status(400).json({ success: false, error: 'Role not found' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    
    // Strict Vertical Scoping check for vertical_admin
    if (req.user.role === 'vertical_admin') {
      const hasAllAccess = verticalAccess.every(vId => req.user.verticalAccess.includes(vId));
      if (!hasAllAccess) {
        return res.status(403).json({ success: false, error: 'Access forbidden: you cannot assign access to verticals you do not manage' });
      }
    }

    const newUserRes = await query(`
      INSERT INTO users (id, name, email, password_hash, role_id, vertical_access, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userId, name, email.toLowerCase(), passwordHash, roleDoc.id, verticalAccess, req.user.sub
    ]);

    const newUser = newUserRes.rows[0];

    await logAudit(req, {
      action: 'user.invite',
      targetCollection: 'users',
      targetId: newUser.id,
      after: { name, email, role, verticalAccess }
    });

    return res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /users/:id
 */
export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await query(`
      SELECT u.id, u.name, u.email, u.role_id, u.vertical_access,
             u.is_active, u.last_login_at, u.created_by, u.created_at, u.updated_at,
             r.name AS role_name, r.permissions
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [id]);
    const userDoc = userRes.rows[0];
    
    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check vertical scope bounds for vertical_admin
    if (req.user.role === 'vertical_admin') {
      const hasOverlap = userDoc.vertical_access.some(v => req.user.verticalAccess.includes(v));
      if (!hasOverlap && userDoc.role_name !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    }

    return res.status(200).json({ success: true, data: userDoc });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PATCH /users/:id
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, isActive } = req.body;
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = { ...user };
    let setClause = [];
    const params = [id];
    let paramIndex = 2;

    if (name) {
      setClause.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (email) {
      setClause.push(`email = $${paramIndex++}`);
      params.push(email.toLowerCase());
    }
    if (isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    if (setClause.length === 0) {
      return res.status(200).json({ success: true, data: user });
    }

    const updateRes = await query(`
      UPDATE users SET ${setClause.join(', ')}, updated_at = NOW() 
      WHERE id = $1 RETURNING *
    `, params);
    const updatedUser = updateRes.rows[0];

    await logAudit(req, {
      action: 'user.update',
      targetCollection: 'users',
      targetId: id,
      before,
      after: updatedUser
    });

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PATCH /users/:id/role
 */
export const changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { role, adminPassword } = req.body;
  try {
    // Parallelize: admin password check + user/role fetches simultaneously
    const [adminRes, userRes, roleRes] = await Promise.all([
        query('SELECT password_hash FROM users WHERE id = $1', [req.user.sub]),
        query('SELECT * FROM users WHERE id = $1', [id]),
        query('SELECT id FROM roles WHERE name = $1', [role]),
    ]);

    const adminUser = adminRes.rows[0];
    const isMatch = await bcrypt.compare(adminPassword, adminUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid administrator password confirmation' });
    }

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const roleDoc = roleRes.rows[0];
    if (!roleDoc) {
      return res.status(400).json({ success: false, error: 'Target role not found' });
    }

    const before = { ...user };
    const updatedRes = await query(`
      UPDATE users SET role_id = $1, updated_at = NOW() 
      WHERE id = $2 RETURNING *
    `, [roleDoc.id, id]);
    const updatedUser = updatedRes.rows[0];

    await logAudit(req, {
      action: 'user.role_change',
      targetCollection: 'users',
      targetId: id,
      before,
      after: updatedUser
    });

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PATCH /users/:id/verticals
 */
export const assignUserVerticals = async (req, res) => {
  const { id } = req.params;
  const { verticalAccess } = req.body;
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const before = userRes.rows[0];
    const updatedRes = await query(`
      UPDATE users SET vertical_access = $1, updated_at = NOW() 
      WHERE id = $2 RETURNING *
    `, [verticalAccess, id]);
    const updatedUser = updatedRes.rows[0];

    await logAudit(req, {
      action: 'user.verticals_change',
      targetCollection: 'users',
      targetId: id,
      before,
      after: updatedUser
    });

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /users/:id
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user has active leads assigned
    const leadsRes = await query('SELECT COUNT(*) FROM leads WHERE assigned_to = $1 AND is_deleted = false', [id]);
    const assignedLeadsCount = parseInt(leadsRes.rows[0].count, 10);
    if (assignedLeadsCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot deactivate user. User currently has ${assignedLeadsCount} active leads assigned.`
      });
    }

    const before = userRes.rows[0];
    const updatedRes = await query(`
      UPDATE users SET is_active = false, updated_at = NOW() 
      WHERE id = $1 RETURNING *
    `, [id]);
    const updatedUser = updatedRes.rows[0];

    await logAudit(req, {
      action: 'user.deactivate',
      targetCollection: 'users',
      targetId: id,
      before,
      after: updatedUser
    });

    return res.status(200).json({ success: true, data: { message: 'User deactivated successfully' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
