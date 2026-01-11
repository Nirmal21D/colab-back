const mongoose = require('mongoose');

/**
 * Notification Model
 * Handles system-wide notifications for users
 */

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        // Study Planner
        'task_due_soon',
        'task_overdue',
        'task_completed',
        'daily_plan_reminder',
        'streak_milestone',
        'streak_at_risk',
        'plan_completed',
        
        // Study Board
        'board_invitation',
        'board_member_joined',
        'board_updated',
        'board_comment',
        
        // Study Notebook/AI
        'document_processed',
        'quiz_generated',
        'mindmap_generated',
        'ai_session_complete',
        
        // Reports/Admin
        'report_submitted',
        'report_resolved',
        'content_flagged',
        'user_suspended',
        
        // General
        'welcome',
        'daily_motivation',
        'achievement_unlocked',
        'system_announcement',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    // Reference to related entity (optional)
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['Task', 'Board', 'Plan', 'Quiz', 'MindMap', 'Report', 'Notebook', 'User'],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    // Action button (optional)
    actionUrl: {
      type: String,
      trim: true,
    },
    actionText: {
      type: String,
      trim: true,
    },
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, priority: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for age
notificationSchema.virtual('age').get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Method to check if notification is urgent
notificationSchema.methods.isUrgent = function () {
  return this.priority === 'urgent' || this.priority === 'high';
};

// Method to format notification for response
notificationSchema.methods.toJSON = function () {
  const notification = this.toObject();
  notification.id = notification._id.toString();
  delete notification._id;
  delete notification.__v;
  return notification;
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to delete old notifications (older than 30 days)
notificationSchema.statics.deleteOldNotifications = async function (userId, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    userId,
    isRead: true,
    createdAt: { $lt: cutoffDate },
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
