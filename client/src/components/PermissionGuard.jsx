import React from 'react';
import { useAuthStore } from '../store/authStore.js';

/**
 * Permission Guard
 * Conditionally renders children if the logged-in operator possesses the required permission.
 */
export const PermissionGuard = ({ permission, fallback = null, children }) => {
  const { user } = useAuthStore();
  
  if (!user || !user.permissions) {
    return fallback;
  }

  // Super Admin wildcard always passes
  const hasWildcard = user.permissions.includes('*');
  const hasPermission = user.permissions.includes(permission);

  if (hasWildcard || hasPermission) {
    return <>{children}</>;
  }

  return fallback;
};

export default PermissionGuard;
