import mongoose from 'mongoose';

const subVerticalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  verticalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vertical',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: true
});

// Ensure name is unique per vertical
subVerticalSchema.index({ verticalId: 1, slug: 1 }, { unique: true });

const SubVertical = mongoose.model('SubVertical', subVerticalSchema);
export default SubVertical;
