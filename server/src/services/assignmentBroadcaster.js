/**
 * Assignment Broadcaster Service
 * Manages Server-Sent Events (SSE) connections for real-time assignment updates.
 */

const clients = new Map(); // Map<userId: string, Set<Response>>

/**
 * Register a client's SSE response object
 */
export const addClient = (userId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);
  console.log(`[SSE] Client added for user ${userId}. Total users: ${clients.size}`);
};

/**
 * Unregister a client's SSE response object
 */
export const removeClient = (userId, res) => {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
};

/**
 * Broadcast assignment update to a specific user AND all admin clients.
 * @param {string} targetUserId - The user whose assignments changed
 * @param {object} payload - { type: 'ASSIGNMENT_UPDATED', ... }
 */
export const broadcast = (targetUserId, payload) => {
  const data = `data: ${JSON.stringify(payload)}\n\n`;

  // 1. Notify the target user (if they have active sessions)
  const userClients = clients.get(targetUserId.toString());
  if (userClients) {
    userClients.forEach(res => res.write(data));
  }

  // 2. Notify all admins (so admin panel live-updates too)
  const adminClients = clients.get('__ADMIN__');
  if (adminClients) {
    adminClients.forEach(res => res.write(data));
  }
};

export const closeAllClients = () => {
  console.log(`[SSE] Closing all active SSE clients...`);
  for (const [userId, resSet] of clients.entries()) {
    for (const res of resSet) {
      try {
        res.end();
      } catch (err) {
        console.error('[SSE] Error closing response stream:', err.message);
      }
    }
  }
  clients.clear();
};

export const broadcastToAll = (payload) => {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [userId, resSet] of clients.entries()) {
    for (const res of resSet) {
      try {
        res.write(data);
      } catch (err) {
        console.error('[SSE] Broadcast error:', err.message);
      }
    }
  }
};

export default {
  addClient,
  removeClient,
  broadcast,
  closeAllClients,
  broadcastToAll
};
