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
      req.user.verticalAccess = cached.combinedAccess;
      return next();
    }
  }

  try {
    const userRes = await query(`
      SELECT u.*, r.name as role_name, r.permissions,
             COALESCE(
               ARRAY(
                 SELECT DISTINCT sv.vertical_id::text
                 FROM user_assignments ua
                 JOIN sub_verticals sv ON ua.sub_vertical_id = sv.id
                 WHERE ua.user_id = u.id AND ua.is_active = true
               ), '{}'::text[]
             ) AS assigned_verticals
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

    const combinedAccess = [...new Set([
      ...(Array.isArray(userDoc.vertical_access) ? userDoc.vertical_access.map(v => String(v)) : []),
      ...(Array.isArray(userDoc.assigned_verticals) ? userDoc.assigned_verticals.map(v => String(v)) : [])
    ])];

    userCache.set(userId, {
      userDoc,
      combinedAccess,
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
    req.user.verticalAccess = combinedAccess;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Failed to attach role: ${error.message}`
    });
  }
};

export default attachRole;
