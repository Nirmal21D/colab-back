import Booking from '../models/Booking.js';
import Appointment from '../models/Appointment.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/helpers.js';
import * as bookingService from '../services/bookingService.js';

/**
 * @desc    Create new booking (Production-ready with atomic transaction)
 * @route   POST /api/bookings
 * @access  Private
 * 
 * HIGH CONCURRENCY SAFE:
 * - Supports idempotency via X-Idempotency-Key header
 * - Atomic transaction prevents double-booking
 * - Captures client metadata for tracking
 */
export const createBooking = asyncHandler(async (req, res) => {
  const {
    appointmentId,
    startTime,
    endTime,
    providerId,
    customerInfo,
    questionAnswers,
    capacity,
  } = req.body;

  // Get idempotency key from header (for handling retries)
  const idempotencyKey = req.headers['x-idempotency-key'] || 
                        req.headers['idempotency-key'];

  // Capture client metadata
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    const result = await bookingService.createBookingAtomic(req.user._id, {
      appointmentId,
      startTime,
      endTime,
      providerId,
      customerInfo,
      questionAnswers,
      capacity,
      idempotencyKey,
      ipAddress,
      userAgent,
    });

    // If it's a duplicate request (idempotent), return 200 instead of 201
    const statusCode = result.isDuplicate ? 200 : 201;
    
    const message = result.isDuplicate
      ? 'Booking already exists'
      : result.paymentRequired
      ? `Booking created. Complete payment within 15 minutes to confirm.`
      : 'Booking confirmed successfully';

    sendSuccess(res, { 
      booking: result.booking,
      confirmationCode: result.confirmationCode,
      paymentRequired: result.paymentRequired,
      reservationExpiry: result.reservationExpiry,
      isDuplicate: result.isDuplicate,
    }, message, statusCode);

  } catch (error) {
    // Handle specific error types with appropriate HTTP codes
    if (error.message.includes('no longer available') || 
        error.message.includes('just booked by another user')) {
      return sendError(res, error.message, 409); // Conflict
    }
    if (error.message.includes('not available for booking')) {
      return sendError(res, error.message, 403); // Forbidden
    }
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404); // Not Found
    }
    if (error.message.includes('advance notice') ||
        error.message.includes('Validation errors')) {
      return sendError(res, error.message, 400); // Bad Request
    }
    
    // Default to 500 for unexpected errors
    console.error('Booking creation error:', error);
    return sendError(res, 'An error occurred while creating the booking', 500);
  }
});

/**
 * @desc    Get all bookings for customer
 * @route   GET /api/bookings/my-bookings
 * @access  Private (Customer)
 */
export const getMyBookings = asyncHandler(async (req, res) => {
  const { status, upcoming } = req.query;

  const result = await bookingService.getCustomerBookings(req.user._id, {
    status,
    upcoming: upcoming === 'true',
  });

  sendSuccess(res, result);
});

/**
 * @desc    Get all bookings for organizer
 * @route   GET /api/bookings/organizer
 * @access  Private (Organizer)
 */
export const getOrganizerBookings = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, appointmentId } = req.query;

  const result = await bookingService.getOrganizerBookings(req.user._id, {
    status,
    startDate,
    endDate,
    appointmentId,
  });

  sendSuccess(res, result);
});

/**
 * @desc    Get single booking
 * @route   GET /api/bookings/:id
 * @access  Private
 */
export const getBooking = asyncHandler(async (req, res) => {
  try {
    const booking = await bookingService.getBookingById(
      req.params.id,
      req.user._id,
      req.user.role
    );

    sendSuccess(res, { booking });
  } catch (error) {
    if (error.message === 'Booking not found') {
      return sendError(res, error.message, 404);
    }
    if (error.message === 'Not authorized to view this booking') {
      return sendError(res, error.message, 403);
    }
    throw error;
  }
});

/**
 * @desc    Cancel booking
 * @route   PATCH /api/bookings/:id/cancel
 * @access  Private
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body;

  try {
    const booking = await bookingService.cancelBookingService(
      req.params.id,
      req.user._id,
      cancellationReason
    );

    sendSuccess(res, { booking }, 'Booking cancelled successfully');
  } catch (error) {
    if (error.message === 'Booking not found') {
      return sendError(res, error.message, 404);
    }
    if (error.message.includes('Not authorized')) {
      return sendError(res, error.message, 403);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @desc    Update booking status
 * @route   PATCH /api/bookings/:id/status
 * @access  Private (Organizer)
 */
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  try {
    const booking = await bookingService.updateBookingStatusService(
      req.params.id,
      req.user._id,
      status
    );

    sendSuccess(res, { booking }, 'Booking status updated');
  } catch (error) {
    if (error.message === 'Booking not found') {
      return sendError(res, error.message, 404);
    }
    if (error.message === 'Not authorized') {
      return sendError(res, error.message, 403);
    }
    throw error;
  }
});

/**
 * @desc    Get available dates for appointment
 * @route   GET /api/bookings/availability/dates/:appointmentId
 * @access  Public
 */
export const getAvailableDates = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return sendError(res, 'startDate and endDate query parameters are required', 400);
  }

  try {
    const dates = await bookingService.getAvailableDates(
      appointmentId,
      new Date(startDate),
      new Date(endDate)
    );

    sendSuccess(res, { dates, count: dates.length });
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @desc    Get available time slots for a specific date
 * @route   GET /api/bookings/availability/slots/:appointmentId
 * @access  Public
 */
export const getAvailableSlots = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { date, providerId } = req.query;

  if (!date) {
    return sendError(res, 'date query parameter is required', 400);
  }

  try {
    const slots = await bookingService.getAvailableTimeSlots(
      appointmentId,
      new Date(date),
      providerId
    );

    sendSuccess(res, { slots, count: slots.length });
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @desc    Validate slot before booking
 * @route   POST /api/bookings/validate-slot
 * @access  Private
 */
export const validateSlot = asyncHandler(async (req, res) => {
  const { appointmentId, startTime, endTime, providerId } = req.body;

  if (!appointmentId || !startTime || !endTime) {
    return sendError(res, 'appointmentId, startTime, and endTime are required', 400);
  }

  try {
    const validation = await bookingService.validateSlotSelection(
      appointmentId,
      startTime,
      endTime,
      providerId
    );

    if (validation.valid) {
      sendSuccess(res, { valid: true }, 'Slot is available');
    } else {
      return sendError(res, validation.error, 409);
    }
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @desc    Get booking by confirmation code
 * @route   GET /api/bookings/confirmation/:code
 * @access  Public
 */
export const getBookingByCode = asyncHandler(async (req, res) => {
  try {
    const booking = await bookingService.getBookingByConfirmationCode(req.params.code);
    sendSuccess(res, { booking });
  } catch (error) {
    return sendError(res, error.message, 404);
  }
});
