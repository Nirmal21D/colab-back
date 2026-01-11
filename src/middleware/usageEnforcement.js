const Usage = require('../models/Usage');
const Subscription = require('../models/Subscription');

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    aiQuestionsPerDay: 10,
    boardsTotal: 1,
    groupMembers: 5,
    storageGB: 0.1,
    fileUploadsPerDay: 5,
    aiModels: ['basic'],
  },
  basic: {
    aiQuestionsPerDay: 100,
    boardsTotal: 5,
    groupMembers: 20,
    storageGB: 5,
    fileUploadsPerDay: 50,
    aiModels: ['basic', 'advanced'],
  },
  pro: {
    aiQuestionsPerDay: -1, // unlimited
    boardsTotal: -1, // unlimited
    groupMembers: 50,
    storageGB: 50,
    fileUploadsPerDay: -1,
    aiModels: ['basic', 'advanced', 'premium'],
  },
  enterprise: {
    aiQuestionsPerDay: -1,
    boardsTotal: -1,
    groupMembers: -1,
    storageGB: 500,
    fileUploadsPerDay: -1,
    aiModels: ['basic', 'advanced', 'premium', 'custom'],
  },
};

// Get user's current plan
const getUserPlan = async (userId) => {
  const subscription = await Subscription.findOne({ 
    user: userId,
    status: { $in: ['active', 'trialing'] }
  });
  
  return subscription?.plan || 'free';
};

// Get plan limits for a user
const getPlanLimits = async (userId) => {
  const plan = await getUserPlan(userId);
  return { plan, limits: PLAN_LIMITS[plan] || PLAN_LIMITS.free };
};

/**
 * Middleware to check AI usage limits
 * Use this before any AI-related endpoint
 */
const checkAIUsageLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const { plan, limits } = await getPlanLimits(userId);
    
    // Unlimited plans can proceed
    if (limits.aiQuestionsPerDay === -1) {
      req.userPlan = plan;
      req.planLimits = limits;
      return next();
    }
    
    // Get today's usage
    const usage = await Usage.getTodayUsage(userId);
    
    if (usage.aiQuestions >= limits.aiQuestionsPerDay) {
      return res.status(429).json({
        success: false,
        error: 'Daily AI limit reached',
        message: `You've used all ${limits.aiQuestionsPerDay} AI questions for today. Upgrade your plan for more.`,
        limitReached: true,
        currentUsage: usage.aiQuestions,
        dailyLimit: limits.aiQuestionsPerDay,
        plan,
        resetTime: getNextResetTime(),
        upgradeUrl: '/pricing',
      });
    }
    
    // Attach usage info to request
    req.userPlan = plan;
    req.planLimits = limits;
    req.currentUsage = usage;
    req.remainingQuestions = limits.aiQuestionsPerDay - usage.aiQuestions;
    
    next();
  } catch (error) {
    console.error('Error checking AI usage limit:', error);
    // Allow request to proceed on error (fail open for better UX)
    next();
  }
};

/**
 * Middleware to check board creation limits
 */
const checkBoardLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const { plan, limits } = await getPlanLimits(userId);
    
    // Unlimited plans can proceed
    if (limits.boardsTotal === -1) {
      req.userPlan = plan;
      req.planLimits = limits;
      return next();
    }
    
    // Count existing boards
    const Board = require('../models/Board');
    const boardCount = await Board.countDocuments({ owner: userId });
    
    if (boardCount >= limits.boardsTotal) {
      return res.status(429).json({
        success: false,
        error: 'Board limit reached',
        message: `You've reached the maximum of ${limits.boardsTotal} boards for your ${plan} plan. Upgrade for more boards.`,
        limitReached: true,
        currentCount: boardCount,
        limit: limits.boardsTotal,
        plan,
        upgradeUrl: '/pricing',
      });
    }
    
    req.userPlan = plan;
    req.planLimits = limits;
    req.boardCount = boardCount;
    req.remainingBoards = limits.boardsTotal - boardCount;
    
    next();
  } catch (error) {
    console.error('Error checking board limit:', error);
    next();
  }
};

/**
 * Middleware to check file upload limits
 */
const checkFileUploadLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const { plan, limits } = await getPlanLimits(userId);
    
    // Unlimited plans can proceed
    if (limits.fileUploadsPerDay === -1) {
      req.userPlan = plan;
      req.planLimits = limits;
      return next();
    }
    
    // Get today's usage
    const usage = await Usage.getTodayUsage(userId);
    
    if (usage.fileUploads >= limits.fileUploadsPerDay) {
      return res.status(429).json({
        success: false,
        error: 'Daily file upload limit reached',
        message: `You've used all ${limits.fileUploadsPerDay} file uploads for today. Upgrade for more.`,
        limitReached: true,
        currentUsage: usage.fileUploads,
        dailyLimit: limits.fileUploadsPerDay,
        plan,
        resetTime: getNextResetTime(),
        upgradeUrl: '/pricing',
      });
    }
    
    req.userPlan = plan;
    req.planLimits = limits;
    req.currentUsage = usage;
    
    next();
  } catch (error) {
    console.error('Error checking file upload limit:', error);
    next();
  }
};

/**
 * Middleware to check storage limits
 */
const checkStorageLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const fileSize = req.file?.size || parseInt(req.headers['content-length']) || 0;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const { plan, limits } = await getPlanLimits(userId);
    const storageLimit = limits.storageGB * 1024 * 1024 * 1024; // Convert GB to bytes
    
    // Get current storage usage (would need to calculate from user's files)
    const User = require('../models/User');
    const user = await User.findById(userId);
    const currentStorage = user?.storageUsed || 0;
    
    if (currentStorage + fileSize > storageLimit) {
      return res.status(429).json({
        success: false,
        error: 'Storage limit reached',
        message: `You've reached your storage limit of ${limits.storageGB}GB. Upgrade for more storage.`,
        limitReached: true,
        currentStorage: formatBytes(currentStorage),
        storageLimit: `${limits.storageGB}GB`,
        plan,
        upgradeUrl: '/pricing',
      });
    }
    
    req.userPlan = plan;
    req.planLimits = limits;
    
    next();
  } catch (error) {
    console.error('Error checking storage limit:', error);
    next();
  }
};

/**
 * Middleware to check if user can use a specific AI model
 */
const checkAIModelAccess = (requiredModel = 'basic') => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      
      const { plan, limits } = await getPlanLimits(userId);
      
      if (!limits.aiModels.includes(requiredModel)) {
        return res.status(403).json({
          success: false,
          error: 'Model not available',
          message: `The ${requiredModel} AI model is not available on your ${plan} plan. Upgrade to access it.`,
          requiredModel,
          availableModels: limits.aiModels,
          plan,
          upgradeUrl: '/pricing',
        });
      }
      
      req.userPlan = plan;
      req.planLimits = limits;
      
      next();
    } catch (error) {
      console.error('Error checking AI model access:', error);
      next();
    }
  };
};

/**
 * Track AI usage after successful request
 * Call this after AI request completes
 */
const trackAIUsage = async (userId, tokens = 0, model = 'basic', questionType = 'chat') => {
  try {
    await Usage.incrementAIUsage(userId, tokens, model, questionType);
  } catch (error) {
    console.error('Error tracking AI usage:', error);
  }
};

/**
 * Track file upload
 */
const trackFileUpload = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await Usage.findOneAndUpdate(
      { user: userId, date: today },
      {
        $inc: { fileUploads: 1 },
        $setOnInsert: { user: userId, date: today },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error tracking file upload:', error);
  }
};

/**
 * Get usage summary for a user
 */
const getUsageSummary = async (userId) => {
  try {
    const { plan, limits } = await getPlanLimits(userId);
    const todayUsage = await Usage.getTodayUsage(userId);
    const monthlyStats = await Usage.getUsageStats(userId, 30);
    
    // Get board count
    const Board = require('../models/Board');
    const boardCount = await Board.countDocuments({ owner: userId });
    
    // Get storage usage
    const User = require('../models/User');
    const user = await User.findById(userId);
    const storageUsed = user?.storageUsed || 0;
    const storageLimit = limits.storageGB * 1024 * 1024 * 1024;
    
    return {
      plan,
      today: {
        aiQuestions: {
          used: todayUsage.aiQuestions,
          limit: limits.aiQuestionsPerDay,
          remaining: limits.aiQuestionsPerDay === -1 ? 'unlimited' : Math.max(0, limits.aiQuestionsPerDay - todayUsage.aiQuestions),
        },
        fileUploads: {
          used: todayUsage.fileUploads,
          limit: limits.fileUploadsPerDay,
          remaining: limits.fileUploadsPerDay === -1 ? 'unlimited' : Math.max(0, limits.fileUploadsPerDay - todayUsage.fileUploads),
        },
      },
      totals: {
        boards: {
          used: boardCount,
          limit: limits.boardsTotal,
          remaining: limits.boardsTotal === -1 ? 'unlimited' : Math.max(0, limits.boardsTotal - boardCount),
        },
        storage: {
          used: formatBytes(storageUsed),
          usedBytes: storageUsed,
          limit: `${limits.storageGB}GB`,
          limitBytes: storageLimit,
          percentUsed: Math.round((storageUsed / storageLimit) * 100),
        },
      },
      monthly: monthlyStats,
      limits,
      resetTime: getNextResetTime(),
    };
  } catch (error) {
    console.error('Error getting usage summary:', error);
    throw error;
  }
};

// Helper functions
function getNextResetTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  PLAN_LIMITS,
  getUserPlan,
  getPlanLimits,
  checkAIUsageLimit,
  checkBoardLimit,
  checkFileUploadLimit,
  checkStorageLimit,
  checkAIModelAccess,
  trackAIUsage,
  trackFileUpload,
  getUsageSummary,
};
