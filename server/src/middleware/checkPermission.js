/**
 * CheckPermission Middleware Factory
 * Restricts route execution to users possessing a specific permission key.
 * Automatically injects data filtering scopes (verticalScope, assignedScope) based on roles.
 */
export const checkPermission = (permissionKeyOrKeys) => {
  return (req, res, next) => {
    if (!req.user || !req.role) {
      return res.status(401).json({
        success: false,
        error: 'User authentication credentials not populated'
      });
    }

    const { name: roleName, permissions } = req.role;

    // super_admin wildcard always passes
    const hasWildcard = permissions.includes('*');
    
    let hasDirectPermission = false;
    if (Array.isArray(permissionKeyOrKeys)) {
      hasDirectPermission = permissionKeyOrKeys.some(key => permissions.includes(key));
    } else {
      hasDirectPermission = permissions.includes(permissionKeyOrKeys);
    }

    // If matching agents, check permissions specifically
    if (!hasWildcard && !hasDirectPermission) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        required: permissionKeyOrKeys
      });
    }

    // Inject Query Scoping variables into the request object
    if (roleName === 'super_admin') {
      req.verticalScope = {};
      req.assignedScope = { isDeleted: false };
    } else if (roleName === 'vertical_admin') {
      // vertical_admin scope is limited to their verticalAccess array
      req.verticalScope = {
        verticalId: { $in: req.user.verticalAccess || [] }
      };
      req.assignedScope = {
        verticalId: { $in: req.user.verticalAccess || [] },
        isDeleted: false
      };
    } else if (roleName === 'agent') {
      // agents are restricted to leads in sub-verticals assigned to them
      req.verticalScope = {
        verticalId: { $in: req.user.verticalAccess || [] }
      };
      req.assignedScope = {
        subVerticalId: { $in: req.user.assignedSubVerticals || [] },
        isDeleted: false
      };
    }

    next();
  };
};

export default checkPermission;
