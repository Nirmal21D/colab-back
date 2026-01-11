import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Resource name is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['room', 'equipment', 'vehicle', 'other'],
    default: 'room',
  },
  description: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    default: '#3B82F6',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Physical resource properties
  capacity: {
    type: Number,
    min: 1,
  },
  location: {
    type: String,
    trim: true,
  },
  // Working hours override (optional, defaults to organizer's hours)
  hasCustomSchedule: {
    type: Boolean,
    default: false,
  },
  // Metadata
  notes: {
    type: String,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  // Statistics
  totalAppointments: {
    type: Number,
    default: 0,
  },
  totalBookings: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
resourceSchema.index({ organizer: 1, isActive: 1 });
resourceSchema.index({ organizer: 1, type: 1 });

const Resource = mongoose.model('Resource', resourceSchema);

export default Resource;
