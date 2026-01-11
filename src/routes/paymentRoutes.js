/**
 * Payment Routes
 * Handles Razorpay payment creation, verification, and webhooks
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
} from '../controllers/paymentController.js';

const router = express.Router();

// Create payment order (protected - customer only)
router.post('/create-order', protect, createPaymentOrder);

// Verify payment after successful payment (protected - customer only)
router.post('/verify', protect, verifyPayment);

// Get payment status for booking (protected)
router.get('/:bookingId/status', protect, getPaymentStatus);

// Razorpay webhook (public - no auth needed, verified by signature)
router.post('/webhook', handleWebhook);

export default router;
