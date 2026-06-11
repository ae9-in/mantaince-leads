import mongoose from 'mongoose';

const csvUploadLogSchema = new mongoose.Schema({
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  verticalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vertical',
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  totalRows: {
    type: Number,
    default: 0,
  },
  successCount: {
    type: Number,
    default: 0,
  },
  failedCount: {
    type: Number,
    default: 0,
  },
  errors: [{
    row: { type: Number, required: true },
    reason: { type: String, required: true }
  }],
  status: {
    type: String,
    enum: ['processing', 'done', 'failed'],
    default: 'processing',
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  suppressReservedKeysWarning: true
});

const CsvUploadLog = mongoose.model('CsvUploadLog', csvUploadLogSchema);
export default CsvUploadLog;
