const asyncHandler = require('../utils/asyncHandler');
const subscriptionService = require('../services/subscription.service');
const { verifyWebhookSignature } = require('../config/razorpay');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');

/**
 * @desc    Handle Razorpay webhooks
 * @route   POST /api/webhooks/razorpay
 * @access  Public (but verified via signature)
 */
const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  // Get webhook signature from headers
  const webhookSignature = req.headers['x-razorpay-signature'];
  
  if (!webhookSignature) {
    return res.status(400).json({
      success: false,
      error: 'Missing webhook signature',
    });
  }

  // Get raw body as string
  const rawBody = req.body.toString();
  
  // Verify webhook signature
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const isValid = verifyWebhookSignature(
    rawBody,
    webhookSignature,
    webhookSecret
  );

  if (!isValid) {
    console.error('Invalid webhook signature');
    return res.status(400).json({
      success: false,
      error: 'Invalid signature',
    });
  }

  // Parse the body
  const webhookBody = JSON.parse(rawBody);
  const event = webhookBody.event;
  const payload = webhookBody.payload;

  console.log(`Received webhook: ${event}`);

  try {
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(payload.subscription.entity);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload.subscription.entity, payload.payment?.entity);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload.subscription.entity);
        break;

      case 'subscription.completed':
        await handleSubscriptionCompleted(payload.subscription.entity);
        break;

      case 'subscription.paused':
        await handleSubscriptionPaused(payload.subscription.entity);
        break;

      case 'subscription.resumed':
        await handleSubscriptionResumed(payload.subscription.entity);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retries for processing errors
    res.status(200).json({ success: true });
  }
});

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(payment) {
  console.log('Processing payment.captured:', payment.id);

  // Update payment record if it exists
  await Payment.findOneAndUpdate(
    { razorpay_payment_id: payment.id },
    {
      status: 'captured',
      capturedAt: new Date(payment.created_at * 1000),
    }
  );
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(payment) {
  console.log('Processing payment.failed:', payment.id);

  // Update payment record
  await Payment.findOneAndUpdate(
    { razorpay_payment_id: payment.id },
    {
      status: 'failed',
      failureReason: payment.error_description || 'Payment failed',
    }
  );
}

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(subscription) {
  console.log('Processing subscription.activated:', subscription.id);

  // Update subscription status
  await Subscription.findOneAndUpdate(
    { razorpay_subscription_id: subscription.id },
    {
      status: 'active',
      currentPeriodStart: new Date(subscription.current_start * 1000),
      currentPeriodEnd: new Date(subscription.current_end * 1000),
      nextBillingDate: subscription.charge_at ? new Date(subscription.charge_at * 1000) : null,
    }
  );
}

/**
 * Handle subscription.charged event (recurring payment)
 */
async function handleSubscriptionCharged(subscription, payment) {
  console.log('Processing subscription.charged:', subscription.id);

  const dbSubscription = await Subscription.findOne({ 
    razorpay_subscription_id: subscription.id 
  });

  if (dbSubscription && payment) {
    // Create payment record for recurring charge
    await Payment.create({
      user: dbSubscription.user,
      subscription: dbSubscription._id,
      razorpay_payment_id: payment.id,
      razorpay_order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      status: 'captured',
      method: payment.method,
      description: `Recurring payment for ${dbSubscription.plan} plan`,
    });

    // Update subscription
    await Subscription.findByIdAndUpdate(dbSubscription._id, {
      lastPaymentDate: new Date(),
      currentPeriodStart: new Date(subscription.current_start * 1000),
      currentPeriodEnd: new Date(subscription.current_end * 1000),
      nextBillingDate: subscription.charge_at ? new Date(subscription.charge_at * 1000) : null,
    });
  }
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(subscription) {
  console.log('Processing subscription.cancelled:', subscription.id);

  const dbSubscription = await Subscription.findOne({ 
    razorpay_subscription_id: subscription.id 
  });

  if (dbSubscription) {
    // Update subscription and user tier
    await Subscription.findByIdAndUpdate(dbSubscription._id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Downgrade user to free tier
    const User = require('../models/User');
    await User.findByIdAndUpdate(dbSubscription.user, {
      subscriptionTier: 'free',
    });
  }
}

/**
 * Handle subscription.completed event (subscription ended)
 */
async function handleSubscriptionCompleted(subscription) {
  console.log('Processing subscription.completed:', subscription.id);

  await Subscription.findOneAndUpdate(
    { razorpay_subscription_id: subscription.id },
    {
      status: 'completed',
    }
  );
}

/**
 * Handle subscription.paused event
 */
async function handleSubscriptionPaused(subscription) {
  console.log('Processing subscription.paused:', subscription.id);

  await Subscription.findOneAndUpdate(
    { razorpay_subscription_id: subscription.id },
    {
      status: 'paused',
    }
  );
}

/**
 * Handle subscription.resumed event
 */
async function handleSubscriptionResumed(subscription) {
  console.log('Processing subscription.resumed:', subscription.id);

  await Subscription.findOneAndUpdate(
    { razorpay_subscription_id: subscription.id },
    {
      status: 'active',
    }
  );
}

module.exports = {
  handleRazorpayWebhook,
};
