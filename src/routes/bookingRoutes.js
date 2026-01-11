import express from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import {
  createBooking,
  getMyBookings,
  getOrganizerBookings,
  getBooking,
  cancelBooking,
  updateBookingStatus,
  getAvailableDates,
  getAvailableSlots,
  validateSlot,
  getBookingByCode,
} from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Rate limiter for booking creation (prevent abuse)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 booking attempts per IP per 15 minutes
  message: 'Too many booking attempts from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
const bookingValidation = [
  body('appointmentId').notEmpty().withMessage('Appointment ID is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
];

// Public routes (availability checking)
router.get('/availability/dates/:appointmentId', getAvailableDates);
router.get('/availability/slots/:appointmentId', getAvailableSlots);
router.get('/confirmation/:code', getBookingByCode);

// Protected routes (with rate limiting)
router.post('/', protect, bookingLimiter, bookingValidation, validate, createBooking);
router.post('/validate-slot', protect, validateSlot);
router.get('/my-bookings', protect, getMyBookings);
router.get('/organizer', protect, authorize('organizer'), getOrganizerBookings);
router.get('/:id', protect, getBooking);
router.patch('/:id/cancel', protect, cancelBooking);
router.patch('/:id/status', protect, authorize('organizer'), updateBookingStatus);

export default router;
