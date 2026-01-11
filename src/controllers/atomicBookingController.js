/**
 * Atomic Booking Controller
 * Production-grade booking endpoints with dual payment flow support
 */

import { asyncHandler, sendSuccess, sendError } from '../utils/helpers.js';
import { createBookingAtomic } from '../services/atomicBookingService.js';
import Appointment from '../models/Appointment.js';

/**
 * @desc    Create new booking with atomic concurrency control
 * @route   POST /api/bookings/atomic
 * @access  Private
 * 
 * Supports both pay_now and pay_later modes:
 * - pay_later: Booking confirmed immediately
 * - pay_now: Temporary reservation created, redirects to payment
 * 
 * CONCURRENCY SAFE:
 * - Uses MongoDB transactions
 * - Atomic capacity checks
 * - No partial states
 */
export const createAtomicBooking = asyncHandler(async (req, res) => {
  const {
    appointmentId,
    startTime,
    endTime,
    date,
    customerInfo,
    questionAnswers,
    capacity,
    assignedTo,
  } = req.body;

  // Validate required fields
  if (!appointmentId || !startTime || !endTime) {
    return sendError(res, 'Missing required fields: appointmentId, startTime, endTime', 400);
  }

  // Validate dates
  const start = new Date(startTime);
  const end = new Date(endTime);
  const bookingDate = date ? new Date(date) : start;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return sendError(res, 'Invalid date format', 400);
  }

  if (end <= start) {
    return sendError(res, 'End time must be after start time', 400);
  }

  if (start < new Date()) {
    return sendError(res, 'Cannot book appointments in the past', 400);
  }

  try {
    // Create booking atomically
    const result = await createBookingAtomic(
      {
        appointmentId,
        startTime: start,
        endTime: end,
        date: bookingDate,
        customerInfo: {
          name: customerInfo?.name || req.user.name,
          email: customerInfo?.email || req.user.email,
          phone: customerInfo?.phone || req.user.phone,
          notes: customerInfo?.notes,
        },
        questionAnswers: questionAnswers || [],
        capacity: capacity || 1,
        assignedTo,
      },
      req.user
    );

    // Fetch appointment for response details
    const appointment = await Appointment.findById(appointmentId)
      .select('title price requiresPayment paymentMode currency');

    // Response structure depends on payment mode
    const response = {
      success: true,
      booking: {
        _id: result.booking._id,
        confirmationCode: result.confirmationCode,
        status: result.booking.status,
        startTime: result.booking.startTime,
        endTime: result.booking.endTime,
        paymentStatus: result.booking.paymentStatus,
        paymentMode: result.paymentMode,
      },
      confirmationCode: result.confirmationCode,
      paymentRequired: result.requiresPayment,
      paymentMode: result.paymentMode,
    };

    // Add payment details if pay_now
    if (result.requiresPayment) {
      response.payment = {
        amount: appointment.price,
        currency: appointment.currency || 'INR',
        reservationExpiry: result.reservationExpiry,
        timeRemaining: Math.floor((new Date(result.reservationExpiry) - new Date()) / 1000), // seconds
      };
    }

    // Add appointment details for frontend
    response.appointment = {
      title: appointment.title,
      requiresPayment: appointment.requiresPayment,
      price: appointment.price,
      currency: appointment.currency,
    };

    sendSuccess(
      res,
      response,
      result.requiresPayment 
        ? 'Booking reserved. Complete payment to confirm.' 
        : 'Booking confirmed successfully',
      result.requiresPayment ? 200 : 201
    );

  } catch (error) {
    console.error('[BookingController] Booking creation failed:', error);

    // User-friendly error messages
    let errorMessage = error.message;
    let statusCode = 400;

    if (error.message.includes('no longer available')) {
      statusCode = 409; // Conflict
    } else if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('Concurrent update')) {
      statusCode = 409;
      errorMessage = 'Slot was just booked by another user. Please try again.';
    }

    sendError(res, errorMessage, statusCode);
  }
});

/**
 * @desc    Get booking status (for polling payment completion)
 * @route   GET /api/bookings/atomic/:bookingId/status
 * @access  Private
 */
export const getBookingStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const Booking = (await import('../models/Booking.js')).default;
  
  const booking = await Booking.findById(bookingId)
    .select('status paymentStatus paymentMode reservationExpiry confirmationCode');

  if (!booking) {
    return sendError(res, 'Booking not found', 404);
  }

  // Check if user owns this booking
  if (booking.customer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Unauthorized', 403);
  }

  // Calculate time remaining for reservations
  let timeRemaining = null;
  if (booking.reservationExpiry) {
    const remaining = Math.floor((new Date(booking.reservationExpiry) - new Date()) / 1000);
    timeRemaining = Math.max(0, remaining);
  }

  sendSuccess(res, {
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMode: booking.paymentMode,
    confirmationCode: booking.confirmationCode,
    reservationExpiry: booking.reservationExpiry,
    timeRemaining,
    expired: booking.status === 'expired',
  });
});

/**
 * @desc    Cancel booking (before completion)
 * @route   PATCH /api/bookings/atomic/:bookingId/cancel
 * @access  Private
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;

  const Booking = (await import('../models/Booking.js')).default;
  
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    return sendError(res, 'Booking not found', 404);
  }

  // Check authorization
  if (booking.customer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Unauthorized to cancel this booking', 403);
  }

  // Cannot cancel already cancelled or completed bookings
  if (['cancelled', 'completed', 'expired'].includes(booking.status)) {
    return sendError(res, `Cannot cancel ${booking.status} booking`, 400);
  }

  // Update booking
  booking.status = 'cancelled';
  booking.cancellationReason = reason || 'Cancelled by customer';
  booking.cancelledAt = new Date();
  booking.cancelledBy = req.user._id;

  // If payment was made, initiate refund
  if (booking.paymentStatus === 'paid' && booking.paymentId) {
    try {
      const razorpayService = (await import('../services/razorpayService.js')).default;
      await razorpayService.initiateRefund(
        booking.paymentId,
        booking.paymentAmount,
        reason || 'Booking cancelled by customer'
      );
      booking.paymentStatus = 'refunded';
    } catch (refundError) {
      console.error('[BookingController] Refund failed:', refundError);
      // Continue with cancellation even if refund fails
      // Manual intervention required
    }
  }

  await booking.save();

  console.log(`[BookingController] Booking ${bookingId} cancelled by user ${req.user._id}`);

  sendSuccess(res, {
    booking: {
      _id: booking._id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      cancelledAt: booking.cancelledAt,
    },
  }, 'Booking cancelled successfully');
});

export default {
  createAtomicBooking,
  getBookingStatus,
  cancelBooking,
};
