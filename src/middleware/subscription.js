const Subscription = require('../models/Subscription');
const AppError = require('../utils/AppError');

/**
 * Feature limits by subscription tier
 */
const FEATURE_LIMITS = {
  free: {
    aiQuestionsPerDay: 10,
    boards: 1,
    groupMembers: 5,
    storageGB: 0.1,
    documentsPerUpload: 1,
    maxDocumentSize: 5, // MB
    aiModels: ['basic'],
  },
  basic: {
    aiQuestionsPerDay: 100,
    boards: 5,
    groupMembers: 20,
    storageGB: 5,
    documentsPerUpload: 5,
    maxDocumentSize: 20, // MB
    aiModels: ['basic', 'advanced'],
  },
  pro: {
    aiQuestionsPerDay: -1, // unlimited
    boards: -1, // unlimited
    groupMembers: 50,
    storageGB: 50,
    documentsPerUpload: 20,
    maxDocumentSize: 100, // MB
    aiModels: ['basic', 'advanced', 'premium'],
    prioritySupport: true,
  },
  enterprise: {
    aiQuestionsPerDay: -1,
    boards: -1,
    groupMembers: -1,
    storageGB: 500,
    documentsPerUpload: -1,
    maxDocumentSize: 500, // MB
    aiModels: ['basic', 'advanced', 'premium', 'custom'],
    prioritySupport: true,
    customIntegrations: true,
    dedicatedSupport: true,
    whiteLabel: true,
  },
};

/**
 * Check if user's subscription allows access to a feature
 * @param {string} feature - Feature name to check
 * @param {string} minTier - Minimum tier required (optional)
 */
const checkFeatureAccess = (feature, minTier = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      // Get user's subscription
      let subscription = await Subscription.findOne({ user: userId });
      
      // Create free subscription if none exists
      if (!subscription) {
        subscription = await Subscription.create({
          user: userId,
          plan: 'free',
          status: 'active',
        });
      }

      // Check if subscription is active
      if (subscription.status !== 'active' || !subscription.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Your subscription has expired. Please renew to continue.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }

      const userTier = subscription.plan;
      const limits = FEATURE_LIMITS[userTier];

      // Check minimum tier requirement
      if (minTier) {
        const tierOrder = ['free', 'basic', 'pro', 'enterprise'];
        const userTierIndex = tierOrder.indexOf(userTier);
        const minTierIndex = tierOrder.indexOf(minTier);
        
        if (userTierIndex < minTierIndex) {
          return res.status(403).json({
            success: false,
            error: `This feature requires ${minTier} plan or higher`,
            code: 'INSUFFICIENT_TIER',
            requiredTier: minTier,
            currentTier: userTier,
          });
        }
      }

      // Check specific feature limit
      if (feature && limits[feature] !== undefined) {
        const featureLimit = limits[feature];
        
        // -1 means unlimited
        if (featureLimit === -1) {
          req.featureLimit = -1;
        } else if (featureLimit === 0 || featureLimit === false) {
          return res.status(403).json({
            success: false,
            error: `This feature is not available in your current plan`,
            code: 'FEATURE_NOT_AVAILABLE',
            upgradeTo: getMinimumTierForFeature(feature),
          });
        } else {
          req.featureLimit = featureLimit;
        }
      }

      // Attach subscription and limits to request
      req.subscription = subscription;
      req.subscriptionLimits = limits;
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has specific feature enabled
 * @param {string} featureName
 */
const requireFeature = (featureName) => {
  return checkFeatureAccess(featureName);
};

/**
 * Require minimum subscription tier
 * @param {string} minTier - 'basic', 'pro', or 'enterprise'
 */
const requireTier = (minTier) => {
  return checkFeatureAccess(null, minTier);
};

/**
 * Get minimum tier that has access to a feature
 * @param {string} feature
 * @returns {string}
 */
function getMinimumTierForFeature(feature) {
  const tiers = ['free', 'basic', 'pro', 'enterprise'];
  
  for (const tier of tiers) {
    const limits = FEATURE_LIMITS[tier];
    if (limits[feature] && limits[feature] !== 0 && limits[feature] !== false) {
      return tier;
    }
  }
  
  return 'enterprise';
}

/**
 * Attach subscription info to request without blocking
 */
const attachSubscription = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      let subscription = await Subscription.findOne({ user: req.user.id });
      
      if (!subscription) {
        subscription = await Subscription.create({
          user: req.user.id,
          plan: 'free',
          status: 'active',
        });
      }
      
      req.subscription = subscription;
      req.subscriptionLimits = FEATURE_LIMITS[subscription.plan];
    }
  } catch (error) {
    console.error('Error attaching subscription:', error);
  }
  
  next();
};

module.exports = {
  checkFeatureAccess,
  requireFeature,
  requireTier,
  attachSubscription,
  FEATURE_LIMITS,
};
