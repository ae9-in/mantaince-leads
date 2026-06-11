import AuditLog from '../models/auditLog.js';

export const logAudit = async (actorId, action, targetCollection, targetId, diff = null, req = null) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    await AuditLog.create({
      actorId,
      action,
      targetCollection,
      targetId,
      diff,
      ip
    });
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
};
export default logAudit;
