import { query } from '../config/db.js';
import { cacheGet, cacheSet } from '../services/cache.js';

/**
 * AttachRole Middleware
 * Loads permissions and attaches the active role definition to the request object.
 * Optimized with self-healing in-memory cache to prevent DB queries on every request.
 */
export const attachRole = async (req, res, next) => {
  if (!req.user || !req.user.sub) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
  }

  const userId = req.user.sub;
  const cacheKey = `user_profile:${userId}`;

  try {
    let cached = await cacheGet(cacheKey);

    if (cached) {
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

    const profileData = {
      userDoc,
      combinedAccess
    };

    // Cache for 10 minutes (600 seconds)
    await cacheSet(cacheKey, profileData, 600);

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
