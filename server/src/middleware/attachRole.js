import { query } from '../config/db.js';

/**
 * AttachRole Middleware
 * Loads permissions and attaches the active role definition to the request object.
 */
const userCache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache

export const attachRole = async (req, res, next) => {
  if (!req.user || !req.user.sub) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
  }

  const userId = req.user.sub;
  const now = Date.now();

  if (userCache.has(userId)) {
    const cached = userCache.get(userId);
    if (now < cached.expiresAt) {
      if (!cached.userDoc.is_active) {
        return res.status(403).json({
          success: false,
          error: 'User account is inactive or disabled'
        });
      }
      req.role = {
        name: cached.userDoc.role_name,
        permissions: cached.userDoc.permissions
      };
      req.user.verticalAccess = cached.userDoc.vertical_access;
      return next();
    }
  }

  try {
    const userRes = await query(`
      SELECT u.*, r.name as role_name, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [userId]);
    
    const userDoc = userRes.rows[0];

    if (!userDoc) {
      return res.status(403).json({
        success: false,
        error: 'User account not found'
      });
    }

    userCache.set(userId, {
      userDoc,
      expiresAt: now + CACHE_TTL
    });

    if (!userDoc.is_active) {
      return res.status(403).json({
        success: false,
        error: 'User account is inactive or disabled'
      });
    }

    req.role = {
      name: userDoc.role_name,
      permissions: userDoc.permissions
    };
    
    // Also attach vertical access if not already in token payload
    req.user.verticalAccess = userDoc.vertical_access;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Failed to attach role: ${error.message}`
    });
  }
};

export default attachRole;
