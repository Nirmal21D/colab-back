import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Appointment title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: 0.25,
    default: 0.5, // in hours
  },
  slotInterval: {
    type: Number,
    min: 5,
    default: null, // null means use duration as interval
  },
  bufferTime: {
    type: Number,
    min: 0,
    default: 0, // in minutes
  },
  // New booking options
  createSlotTime: {
    type: Number,
    default: 0.5, // in hours
  },
  manualConfirmationCapacity: {
    type: Number,
    default: 50, // percentage
  },
  bookingFees: {
    type: Number,
    default: 0,
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  assignmentType: {
    type: String,
    enum: ['staff', 'resource', 'auto'],
    default: 'auto',
  },
  // Assignment configuration
  assignedStaff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  }],
  assignedResources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
  }],
  customerCanChoose: {
    type: Boolean,
    default: false,
  },
  simultaneousBookings: {
    type: Boolean,
    default: false,
  },
  simultaneousCount: {
    type: Number,
    default: 1,
  },
  // Scheduling rules
  advanceBookingDays: {
    type: Number,
    default: 30,
  },
  minNoticeHours: {
    type: Number,
    default: 24,
  },
  // Visibility and status
  isPublished: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Booking link
  slug: {
    type: String,
    unique: true,
    required: true,
  },
  // Payment settings (optional)
  requiresPayment: {
    type: Boolean,
    default: false,
  },
  price: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR', // Changed to INR for Razorpay (Indian market)
  },
  // Payment mode: determines booking flow
  paymentMode: {
    type: String,
    enum: ['pay_now', 'pay_later'],
    default: 'pay_later',
    // pay_now: User must complete payment before booking confirmation (creates reservation)
    // pay_later: Booking confirmed immediately, payment not required upfront
  },
  // Additional fields
  location: {
    type: String,
  },
  locationType: {
    type: String,
    enum: ['inPerson', 'virtual', 'phone'],
    default: 'inPerson',
  },
  meetingLink: {
    type: String,
  },
  color: {
    type: String,
    default: '#3B82F6',
  },
  image: {
    type: String,
  },
  // Cancellation policy
  allowCancellation: {
    type: Boolean,
    default: true,
  },
  cancellationHours: {
    type: Number,
    default: 24,
  },
  // Booking questions/form fields
  questions: [{
    question: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'email', 'phone', 'select', 'textarea', 'number', 'date'],
      default: 'text',
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: [String], // For select type
    placeholder: String,
    order: Number,
  }],
  // Manual confirmation
  requiresManualConfirmation: {
    type: Boolean,
    default: false,
  },
  // Custom messages
  introductionMessage: {
    type: String,
    default: '',
  },
  confirmationMessage: {
    type: String,
    default: '',
  },
  // Share link for unpublished appointments
  shareToken: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
  },
  shareTokenExpiry: {
    type: Date,
  },
  shareTokenEnabled: {
    type: Boolean,
    default: false,
  },
  // Statistics
  totalBookings: {
    type: Number,
    default: 0,
  },
  // Optimistic locking for concurrency control
  lockVersion: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
appointmentSchema.index({ organizer: 1, isActive: 1 });
appointmentSchema.index({ isPublished: 1, isActive: 1 }); // For public queries
appointmentSchema.index({ shareToken: 1 });
appointmentSchema.index({ slug: 1 }); // For slug-based lookups

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
