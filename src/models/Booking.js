import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Booking details
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  // Assignment
  assignedTo: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resourceName: String,
  },
  // Status management
  status: {
    type: String,
    enum: ['pending_payment', 'confirmed', 'cancelled', 'expired', 'completed', 'no-show'],
    default: 'confirmed',
    // pending_payment: Temporary reservation, awaiting payment
    // confirmed: Booking confirmed (pay_later or successful pay_now)
    // expired: Reservation expired without payment
    // cancelled: User or organizer cancelled
    // completed/no-show: Post-appointment statuses
  },
  // Optimistic locking for concurrency control
  __v: {
    type: Number,
    default: 0,
  },
  // Customer information
  customerInfo: {
    name: String,
    email: String,
    phone: String,
    notes: String,
  },
  // Question answers from appointment form
  questionAnswers: [{
    question: String,
    answer: String,
  }],
  // Cancellation
  cancellationReason: {
    type: String,
  },
  cancelledAt: {
    type: Date,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Payment
  paymentStatus: {
    type: String,
    enum: ['not_required', 'pending', 'paid', 'refunded', 'failed'],
    default: 'not_required',
    // not_required: Pay later mode or free appointment
    // pending: Payment initiated but not completed
    // paid: Payment successful
    // failed: Payment failed
    // refunded: Booking cancelled, payment refunded
  },
  paymentMode: {
    type: String,
    enum: ['pay_now', 'pay_later', 'not_applicable'],
    default: 'not_applicable',
  },
  paymentAmount: {
    type: Number,
    default: 0,
  },
  paymentId: {
    type: String,
  },
  // Reminders
  reminderSent: {
    type: Boolean,
    default: false,
  },
  // Confirmation
  confirmationCode: {
    type: String,
    unique: true,
  },
  // Capacity for group bookings
  capacity: {
    type: Number,
    default: 1,
    min: 1,
  },
  // Temporary reservation for payment flows (IRCTC-style)
  reservationExpiry: {
    type: Date,
    index: true, // For TTL cleanup
  },
  isReservationExpired: {
    type: Boolean,
    default: false,
  },
  // Metadata for idempotency and tracking
  metadata: {
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    bookedAt: Date,
    ipAddress: String,
    userAgent: String,
    retryCount: {
      type: Number,
      default: 0,
    },
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries and concurrency
bookingSchema.index({ appointment: 1, date: 1 });
bookingSchema.index({ appointment: 1, startTime: 1, status: 1 }); // Critical for availability checks
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ organizer: 1, date: 1 });
bookingSchema.index({ startTime: 1, endTime: 1 });
bookingSchema.index({ confirmationCode: 1 });
bookingSchema.index({ 'metadata.idempotencyKey': 1 }, { sparse: true }); // For duplicate prevention
bookingSchema.index({ reservationExpiry: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { reservationExpiry: { $exists: true } } }); // TTL index

// Prevent double bookings - compound index
bookingSchema.index({ 
  appointment: 1, 
  startTime: 1, 
  'assignedTo.userId': 1,
  status: 1 
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
