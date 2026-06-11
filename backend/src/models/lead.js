import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  verticalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vertical',
    required: true,
  },
  subVerticalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubVertical',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    trim: true,
  },
  businessName: {
    type: String,
    trim: true,
  },
  // Dynamic fields stored as a flexible map
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'converted', 'lost'],
    default: 'new',
  },
  source: {
    type: String,
    enum: ['manual', 'csv_upload', 'api'],
    default: 'manual',
  },
  csvBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CsvUploadLog',
  }
}, {
  timestamps: true
});

// Indexes

// Compound query index for agents / vertical admins
leadSchema.index({ verticalId: 1, assignedTo: 1, status: 1, createdAt: -1 });

// Index on area for fast geographical filtering
leadSchema.index({ 'data.area': 1 });

// Index for filtering by sub-verticals and status
leadSchema.index({ verticalId: 1, subVerticalId: 1, status: 1, createdAt: -1 });

// Index for boolean filtering of spoken/delivered
leadSchema.index({ verticalId: 1, 'data.spoken': 1, 'data.delivered': 1, createdAt: -1 });

// Unique compound index on verticalId and phone using partial filter expression
// This prevents duplicate phones in the same vertical while allowing empty/null phone values.
leadSchema.index(
  { verticalId: 1, phone: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      phone: { $type: "string", $gt: "" } 
    } 
  }
);

// Text index on name, businessName, and area for text search bar
leadSchema.index({ 
  name: 'text', 
  businessName: 'text', 
  'data.area': 'text' 
});

const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
