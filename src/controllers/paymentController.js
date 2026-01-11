/**
 * Payment Controller
 * Handles Razorpay payment operations
 */

import { asyncHandler, sendSuccess, sendError } from '../utils/helpers.js';
import razorpayService from '../services/razorpayService.js';
import Booking from '../models/Booking.js';
import Appointment from '../models/Appointment.js';

/**
 * @desc    Create Razorpay order for booking payment
 * @route   POST /api/payments/create-order
 * @access  Private (Customer)
 */
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return sendError(res, 'Booking ID is required', 400);
  }

  // Fetch booking
  const booking = await Booking.findById(bookingId)
    .populate('appointment', 'price currency requiresPayment title');

  if (!booking) {
    return sendError(res, 'Booking not found', 404);
  }

  // Verify booking belongs to logged-in user
  if (booking.customer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Unauthorized to create payment for this booking', 403);
  }

  // Check if payment already completed
  if (booking.paymentStatus === 'paid') {
    return sendError(res, 'Payment already completed for this booking', 400);
  }

  // Check if appointment requires payment
  if (!booking.appointment.requiresPayment) {
    return sendError(res, 'This appointment does not require payment', 400);
  }

  // Create Razorpay order
  const result = await razorpayService.createOrder(booking, booking.appointment);

  if (!result.success) {
    return sendError(res, result.error || 'Failed to create payment order', 500);
  }

  sendSuccess(res, {
    order: result.order,
    booking: {
      id: booking._id,
      confirmationCode: booking.confirmationCode,
    },
    amount: booking.appointment.price,
    currency: booking.appointment.currency || 'INR',
    key: process.env.RAZORPAY_KEY_ID, // Send key to frontend
  }, 'Payment order created successfully');
});

/**
 * @desc    Verify Razorpay payment
 * @route   POST /api/payments/verify
 * @access  Private (Customer)
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bookingId,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
    return sendError(res, 'Missing payment verification details', 400);
  }

  // Verify signature
  const isValid = razorpayService.verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    return sendError(res, 'Invalid payment signature', 400);
  }

  // Update booking with payment success
  const result = await razorpayService.handlePaymentSuccess(bookingId, {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!result.success) {
    return sendError(res, result.error || 'Failed to update payment status', 500);
  }

  sendSuccess(res, {
    booking: result.booking,
  }, 'Payment verified successfully');
});

/**
 * @desc    Get payment status for booking
 * @route   GET /api/payments/:bookingId/status
 * @access  Private
 */
export const getPaymentStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId)
    .select('paymentStatus paymentAmount paymentId status');

  if (!booking) {
    return sendError(res, 'Booking not found', 404);
  }

  // Verify user has access to this booking
  if (booking.customer.toString() !== req.user._id.toString() &&
      booking.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Unauthorized to view payment status', 403);
  }

  sendSuccess(res, {
    paymentStatus: booking.paymentStatus,
    paymentAmount: booking.paymentAmount,
    paymentId: booking.paymentId,
    bookingStatus: booking.status,
  });
});

/**
 * @desc    Handle Razorpay webhook
 * @route   POST /api/payments/webhook
 * @access  Public (verified by signature)
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    return sendError(res, 'Missing webhook signature', 400);
  }

  // Verify webhook signature
  const isValid = razorpayService.verifyWebhookSignature(req.body, signature);

  if (!isValid) {
    return sendError(res, 'Invalid webhook signature', 400);
  }

  const event = req.body.event;
  const payload = req.body.payload.payment.entity;

  console.log('📡 Razorpay Webhook:', event);

  try {
    switch (event) {
      case 'payment.captured':
        // Payment successful
        const bookingId = payload.notes?.bookingId;
        if (bookingId) {
          await razorpayService.handlePaymentSuccess(bookingId, {
            razorpay_payment_id: payload.id,
            razorpay_order_id: payload.order_id,
          });
          console.log('✅ Payment captured for booking:', bookingId);
        }
        break;

      case 'payment.failed':
        // Payment failed
        const failedBookingId = payload.notes?.bookingId;
        if (failedBookingId) {
          await razorpayService.handlePaymentFailure(
            failedBookingId,
            payload.error_description
          );
          console.log('❌ Payment failed for booking:', failedBookingId);
        }
        break;

      case 'refund.processed':
        // Refund processed
        console.log('💰 Refund processed:', payload.id);
        break;

      default:
        console.log('ℹ️ Unhandled webhook event:', event);
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});
