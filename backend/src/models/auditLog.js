import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String, // e.g., "lead.create", "vertical.update", etc.
    required: true,
  },
  targetCollection: {
    type: String,
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  diff: {
    type: mongoose.Schema.Types.Mixed, // Stores before/after snapshot or changed fields
  },
  ip: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7776000 // 90 days in seconds (90 * 24 * 60 * 60)
  }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
