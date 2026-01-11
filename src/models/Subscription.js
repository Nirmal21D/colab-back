const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One active subscription per user
    },
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'pending', 'paused'],
      default: 'active',
    },
    
    // Razorpay specific fields
    razorpay_subscription_id: {
      type: String,
      sparse: true, // Allows multiple null values but unique non-null
    },
    razorpay_plan_id: {
      type: String,
    },
    razorpay_customer_id: {
      type: String,
    },
    
    // Billing details
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    
    // Pricing
    amount: {
      type: Number, // in smallest currency unit (paise for INR)
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    interval: {
      type: String,
      enum: ['monthly', 'yearly', 'lifetime'],
      default: 'monthly',
    },
    
    // Trial
    trialStart: {
      type: Date,
    },
    trialEnd: {
      type: Date,
    },
    
    // Payment history reference
    lastPaymentDate: {
      type: Date,
    },
    nextBillingDate: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    
    // Metadata
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (removed duplicates - user and razorpay_subscription_id already have unique/sparse)
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

// Virtual for checking if subscription is in trial
subscriptionSchema.virtual('isInTrial').get(function () {
  if (!this.trialEnd) return false;
  return new Date() < this.trialEnd;
});

// Virtual for checking if subscription is active
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && (!this.currentPeriodEnd || new Date() <= this.currentPeriodEnd);
});

// Method to check if user can access a feature
subscriptionSchema.methods.canAccessFeature = function (feature) {
  const planFeatures = {
    free: {
      aiQuestionsPerDay: 10,
      boards: 1,
      groupMembers: 5,
      storageGB: 0.1,
      aiModels: ['basic'],
      prioritySupport: false,
    },
    basic: {
      aiQuestionsPerDay: 100,
      boards: 5,
      groupMembers: 20,
      storageGB: 5,
      aiModels: ['basic', 'advanced'],
      prioritySupport: false,
    },
    pro: {
      aiQuestionsPerDay: -1, // unlimited
      boards: -1, // unlimited
      groupMembers: 50,
      storageGB: 50,
      aiModels: ['basic', 'advanced', 'premium'],
      prioritySupport: true,
    },
    enterprise: {
      aiQuestionsPerDay: -1,
      boards: -1,
      groupMembers: -1,
      storageGB: 500,
      aiModels: ['basic', 'advanced', 'premium', 'custom'],
      prioritySupport: true,
      customIntegrations: true,
      dedicatedSupport: true,
    },
  };

  const features = planFeatures[this.plan] || planFeatures.free;
  return features[feature];
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
