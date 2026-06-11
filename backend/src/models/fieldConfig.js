import mongoose from 'mongoose';

const fieldConfigSchema = new mongoose.Schema({
  verticalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vertical',
    required: true,
  },
  fieldKey: {
    type: String,
    required: true,
    trim: true,
  },
  label: {
    type: String,
    required: true,
    trim: true,
  },
  fieldType: {
    type: String,
    required: true,
    enum: ['text', 'number', 'select', 'boolean', 'date', 'url', 'textarea'],
  },
  options: {
    type: [String],
    default: [], // Used when fieldType is 'select'
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  isCsvMapped: {
    type: Boolean,
    default: false,
  },
  csvHeader: {
    type: String,
    trim: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  isVisible: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true
});

// Ensure fieldKey is unique within the same vertical
fieldConfigSchema.index({ verticalId: 1, fieldKey: 1 }, { unique: true });

const FieldConfig = mongoose.model('FieldConfig', fieldConfigSchema);
export default FieldConfig;
