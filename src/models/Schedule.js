import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
  },
  // Optional: For staff/resource-specific schedules
  assignedTo: {
    model: {
      type: String,
      enum: ['Staff', 'Resource'],
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'assignedTo.model',
    },
  },
  // Weekly working hours
  workingHours: {
    type: [{
      dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6, // 0 = Sunday, 6 = Saturday
      },
      isAvailable: {
        type: Boolean,
        default: true,
      },
      slots: [{
        startTime: {
          type: String,
          required: true, // Format: "HH:mm" (24-hour)
        },
        endTime: {
          type: String,
          required: true,
        },
      }],
    }],
    // Default: Monday-Friday 9 AM - 5 PM
    default: function() {
      return [
        { dayOfWeek: 0, isAvailable: false, slots: [] }, // Sunday
        { dayOfWeek: 1, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Monday
        { dayOfWeek: 2, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Tuesday
        { dayOfWeek: 3, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Wednesday
        { dayOfWeek: 4, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Thursday
        { dayOfWeek: 5, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Friday
        { dayOfWeek: 6, isAvailable: false, slots: [] }, // Saturday
      ];
    }
  },
  // Date-specific overrides
  dateOverrides: [{
    date: {
      type: Date,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    slots: [{
      startTime: String,
      endTime: String,
    }],
    reason: {
      type: String, // e.g., "Holiday", "Special Event"
    },
  }],
  // Timezone
  timezone: {
    type: String,
    default: 'UTC',
  },
}, {
  timestamps: true,
});

// Indexes
scheduleSchema.index({ appointment: 1 });
scheduleSchema.index({ 'assignedTo.model': 1, 'assignedTo.id': 1 });

const Schedule = mongoose.model('Schedule', scheduleSchema);

export default Schedule;
