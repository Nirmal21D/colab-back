/**
 * Atomic Booking Routes
 * Production-grade endpoints with concurrency control
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createAtomicBooking,
  getBookingStatus,
  cancelBooking,
} from '../controllers/atomicBookingController.js';

const router = express.Router();

// Create booking with atomic concurrency control
// Supports both pay_now and pay_later modes
router.post('/atomic', protect, createAtomicBooking);

// Get booking status (for polling during payment)
router.get('/atomic/:bookingId/status', protect, getBookingStatus);

// Cancel booking
router.patch('/atomic/:bookingId/cancel', protect, cancelBooking);

export default router;
