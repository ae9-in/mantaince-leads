import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import Role from '../models/role.js';

export const PERMISSIONS = {
  super_admin: ['*'],
  vertical_admin: [
    'leads:read', 'leads:create', 'leads:update', 'leads:delete',
    'users:read', 'users:invite',
    'vertical:read', 'sub_vertical:manage',
    'csv:upload', 'csv:download_template'
  ],
  agent: [
    'leads:read_own', 'leads:create', 'leads:update',
    'csv:upload', 'csv:download_template'
  ]
};

// Authenticate JWT from headers or cookies
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Check cookies
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_access_secret_fallback_12345');
    
    // Attach user payload
    req.user = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      roleName: decoded.roleName,
      verticalAccess: decoded.verticalAccess || []
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Attach permissions map to the request
export const attachRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const roleName = req.user.roleName;
  req.permissions = PERMISSIONS[roleName] || [];
  next();
};

// Check if current user role has the required permission
export const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user || !req.permissions) {
      return res.status(403).json({ message: 'Access forbidden: missing permissions' });
    }

    const hasWildcard = req.permissions.includes('*');
    const hasSpecific = req.permissions.includes(requiredPermission);

    if (hasWildcard || hasSpecific) {
      return next();
    }

    // Special check for leads read own vs leads read general
    if (requiredPermission === 'leads:read' && req.permissions.includes('leads:read_own')) {
      return next();
    }

    return res.status(403).json({ message: `Access forbidden: requires permission ${requiredPermission}` });
  };
};

// Scope filters for MongoDB lead queries
export const injectScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const roleName = req.user.roleName;
  const userId = req.user.userId;
  const verticalAccess = req.user.verticalAccess;

  const scopeFilter = {};

  if (roleName === 'super_admin') {
    // Super Admin has access to all verticals and users
    req.scopeFilter = {};
  } else if (roleName === 'vertical_admin') {
    // Vertical Admin only sees leads in their verticalAccess list
    req.scopeFilter = { verticalId: { $in: verticalAccess } };
  } else if (roleName === 'agent') {
    // Agent only sees leads assigned to them (and optionally in their verticalAccess)
    req.scopeFilter = { 
      assignedTo: userId,
      verticalId: { $in: verticalAccess }
    };
  } else {
    // Unknown role: restrict completely
    req.scopeFilter = { _id: null };
  }

  next();
};

// Validate mutations against user verticalAccess
export const validateVerticalAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const roleName = req.user.roleName;
  if (roleName === 'super_admin') {
    return next();
  }

  const verticalId = req.body.verticalId || req.query.verticalId;
  if (!verticalId) {
    return next(); // If not mutating verticalId, let model validation or route handle missing field
  }

  const hasAccess = req.user.verticalAccess.includes(verticalId.toString());
  if (!hasAccess) {
    return res.status(403).json({ message: 'Access forbidden: you do not have access to this vertical' });
  }

  next();
};
