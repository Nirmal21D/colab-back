/**
 * Razorpay Payment Service
 * Handles payment order creation, verification, and webhooks
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import { confirmPaymentIdempotent, handlePaymentFailure } from './atomicBookingService.js';

class RazorpayService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Create a Razorpay order for booking payment
   */
  async createOrder(booking, appointment) {
    try {
      const amount = Math.round(appointment.price * 100); // Convert to paise (smallest currency unit)

      const orderOptions = {
        amount,
        currency: appointment.currency || 'INR',
        receipt: `booking_${booking._id}`,
        notes: {
          bookingId: booking._id.toString(),
          appointmentId: appointment._id.toString(),
          customerEmail: booking.customerInfo.email,
          confirmationCode: booking.confirmationCode,
        },
      };

      const order = await this.razorpay.orders.create(orderOptions);

      return {
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt,
        },
      };
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Handle successful payment
   * Uses idempotent confirmation to handle retries and duplicate webhooks safely
   */
  async handlePaymentSuccess(bookingId, paymentDetails) {
    try {
      console.log(`[Razorpay] Processing payment success for booking: ${bookingId}`);
      
      // Use idempotent confirmation from atomic booking service
      const result = await confirmPaymentIdempotent(bookingId, {
        paymentId: paymentDetails.razorpay_payment_id,
        orderId: paymentDetails.razorpay_order_id,
      });
      
      if (result.alreadyProcessed) {
        console.log(`[Razorpay] Duplicate payment webhook ignored for booking: ${bookingId}`);
      }

      return {
        success: true,
        booking: result.booking,
        alreadyProcessed: result.alreadyProcessed || false,
      };
    } catch (error) {
      console.error('[Razorpay] Payment success handling failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(bookingId, reason) {
    try {
      console.log(`[Razorpay] Processing payment failure for booking: ${bookingId}`);
      
      // Use atomic service to handle failure properly
      const result = await handlePaymentFailure(bookingId, reason);

      return {
        success: true,
        booking: result.booking,
      };
    } catch (error) {
      console.error('[Razorpay] Payment failure handling failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Initiate refund for cancelled booking
   */
  async initiateRefund(paymentId, amount, reason) {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100), // Convert to paise
        notes: {
          reason,
        },
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
        },
      };
    } catch (error) {
      console.error('Refund initiation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new RazorpayService();
