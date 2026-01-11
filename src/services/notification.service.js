const Notification = require('../models/Notification');

/**
 * Notification Service
 * Business logic for creating and managing notifications
 */

class NotificationService {
  /**
   * Create a notification for a user
   */
  async createNotification({
    userId,
    type,
    title,
    message,
    priority = 'medium',
    relatedEntity = null,
    actionUrl = null,
    actionText = null,
    metadata = null,
    expiresAt = null,
  }) {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      priority,
      relatedEntity,
      actionUrl,
      actionText,
      metadata,
      expiresAt,
    });

    return notification;
  }

  /**
   * Create multiple notifications at once
   */
  async createBulkNotifications(notifications) {
    return Notification.insertMany(notifications);
  }

  /**
   * Get notifications for a user with filters
   */
  async getUserNotifications(userId, { isRead, type, priority, limit = 50, skip = 0 } = {}) {
    const query = { userId };

    if (isRead !== undefined) {
      query.isRead = isRead;
    }
    if (type) {
      query.type = type;
    }
    if (priority) {
      query.priority = priority;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Notification.countDocuments(query);

    return {
      notifications,
      total,
      unreadCount: await Notification.getUnreadCount(userId),
    };
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId) {
    return Notification.getUnreadCount(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    return Notification.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!result) {
      throw new Error('Notification not found');
    }

    return result;
  }

  /**
   * Delete all read notifications for user
   */
  async deleteAllRead(userId) {
    return Notification.deleteMany({ userId, isRead: true });
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(userId, daysOld = 30) {
    return Notification.deleteOldNotifications(userId, daysOld);
  }

  // ============================================================================
  // NOTIFICATION GENERATORS - Create notifications for specific events
  // ============================================================================

  /**
   * Study Planner Notifications
   */
  async notifyTaskDueSoon(userId, task) {
    return this.createNotification({
      userId,
      type: 'task_due_soon',
      title: '📝 Task Due Soon',
      message: `"${task.title}" is due in 1 hour!`,
      priority: 'high',
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id || task.id,
      },
      actionUrl: '/planner',
      actionText: 'View Task',
    });
  }

  async notifyTaskOverdue(userId, task) {
    return this.createNotification({
      userId,
      type: 'task_overdue',
      title: '⚠️ Task Overdue',
      message: `"${task.title}" is now overdue. Complete it to stay on track!`,
      priority: 'urgent',
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id || task.id,
      },
      actionUrl: '/planner',
      actionText: 'Complete Task',
    });
  }

  async notifyDailyPlanReminder(userId, todayTasksCount) {
    return this.createNotification({
      userId,
      type: 'daily_plan_reminder',
      title: '🌅 Good Morning!',
      message: `You have ${todayTasksCount} task${todayTasksCount === 1 ? '' : 's'} scheduled for today. Let's make it count!`,
      priority: 'medium',
      actionUrl: '/planner',
      actionText: 'View Today',
    });
  }

  async notifyStreakAtRisk(userId, currentStreak) {
    return this.createNotification({
      userId,
      type: 'streak_at_risk',
      title: '🔥 Streak Alert!',
      message: `Your ${currentStreak}-day streak is at risk! Complete a task today to keep it going.`,
      priority: 'high',
      actionUrl: '/planner',
      actionText: 'View Tasks',
    });
  }

  async notifyStreakMilestone(userId, streak) {
    const milestones = {
      7: '1 Week',
      14: '2 Weeks',
      30: '1 Month',
      100: '100 Days',
    };
    const milestone = milestones[streak] || `${streak} Days`;

    return this.createNotification({
      userId,
      type: 'streak_milestone',
      title: '🎉 Streak Milestone!',
      message: `Amazing! You've maintained a ${milestone} study streak!`,
      priority: 'low',
      actionUrl: '/profile',
      actionText: 'View Stats',
    });
  }

  async notifyPlanCompleted(userId, plan) {
    return this.createNotification({
      userId,
      type: 'plan_completed',
      title: '✅ Plan Completed!',
      message: `Congratulations! You've completed "${plan.title}". Time to celebrate! 🎊`,
      priority: 'medium',
      actionUrl: '/planner',
      actionText: 'View Plans',
    });
  }

  async notifyDailyPlanReminder(userId, taskCount) {
    return this.createNotification({
      userId,
      type: 'daily_plan_reminder',
      title: '🌅 Good Morning!',
      message: `You have ${taskCount} task${taskCount > 1 ? 's' : ''} scheduled for today. Let's make it count!`,
      priority: 'medium',
      actionUrl: '/planner',
      actionText: 'View Tasks',
    });
  }

  /**
   * Study Board Notifications
   */
  async notifyBoardInvitation(userId, board, invitedBy) {
    return this.createNotification({
      userId,
      type: 'board_invitation',
      title: '📋 Board Invitation',
      message: `${invitedBy.name} invited you to collaborate on "${board.title}"`,
      priority: 'high',
      relatedEntity: {
        entityType: 'Board',
        entityId: board._id || board.id,
      },
      actionUrl: `/study-board/${board._id || board.id}`,
      actionText: 'View Board',
    });
  }

  async notifyBoardMemberJoined(userId, board, member) {
    return this.createNotification({
      userId,
      type: 'board_member_joined',
      title: '👋 New Collaborator',
      message: `${member.name} joined your board "${board.title}"`,
      priority: 'low',
      relatedEntity: {
        entityType: 'Board',
        entityId: board._id || board.id,
      },
      actionUrl: `/study-board/${board._id || board.id}`,
      actionText: 'View Board',
    });
  }

  /**
   * AI/Notebook Notifications
   */
  async notifyDocumentProcessed(userId, documentName) {
    return this.createNotification({
      userId,
      type: 'document_processed',
      title: '📄 Document Ready',
      message: `"${documentName}" has been processed and is ready for AI Q&A!`,
      priority: 'medium',
      actionUrl: '/study-notebook',
      actionText: 'Ask Questions',
    });
  }

  async notifyQuizGenerated(userId, quiz) {
    return this.createNotification({
      userId,
      type: 'quiz_generated',
      title: '📝 Quiz Generated',
      message: `Your quiz "${quiz.title}" with ${quiz.questions?.length || 0} questions is ready!`,
      priority: 'medium',
      relatedEntity: {
        entityType: 'Quiz',
        entityId: quiz._id || quiz.id,
      },
      actionUrl: '/visual-aids',
      actionText: 'Take Quiz',
    });
  }

  async notifyMindmapGenerated(userId, mindmap) {
    return this.createNotification({
      userId,
      type: 'mindmap_generated',
      title: '🗺️ Mind Map Created',
      message: `Mind map for "${mindmap.topic}" is ready to explore!`,
      priority: 'medium',
      relatedEntity: {
        entityType: 'MindMap',
        entityId: mindmap._id || mindmap.id,
      },
      actionUrl: '/visual-aids',
      actionText: 'View Mind Map',
    });
  }

  /**
   * Admin/Report Notifications
   */
  async notifyReportSubmitted(adminUserId, report) {
    return this.createNotification({
      userId: adminUserId,
      type: 'report_submitted',
      title: '⚠️ New Report',
      message: `A new ${report.contentType} report has been submitted`,
      priority: 'high',
      relatedEntity: {
        entityType: 'Report',
        entityId: report._id || report.id,
      },
      actionUrl: '/admin',
      actionText: 'Review Report',
    });
  }

  async notifyContentFlagged(userId, contentType, action) {
    return this.createNotification({
      userId,
      type: 'content_flagged',
      title: '⚠️ Content Action',
      message: `Your ${contentType} was ${action} after review`,
      priority: 'high',
      actionUrl: '/profile',
      actionText: 'Learn More',
    });
  }

  /**
   * General Notifications
   */
  async notifyWelcome(userId, userName) {
    return this.createNotification({
      userId,
      type: 'welcome',
      title: '👋 Welcome to Collabry!',
      message: `Hi ${userName}! Start by creating your first study plan or joining a study board.`,
      priority: 'low',
      actionUrl: '/dashboard',
      actionText: 'Get Started',
    });
  }

  async notifyDailyMotivation(userId) {
    const motivations = [
      'The secret of getting ahead is getting started. 🚀',
      'Success is the sum of small efforts repeated day in and day out. 💪',
      'Don\'t watch the clock; do what it does. Keep going. ⏰',
      'The expert in anything was once a beginner. 🌱',
      'Your limitation—it\'s only your imagination. ✨',
    ];

    const message = motivations[Math.floor(Math.random() * motivations.length)];

    return this.createNotification({
      userId,
      type: 'daily_motivation',
      title: '💡 Daily Motivation',
      message,
      priority: 'low',
      expiresAt: new Date(Date.now() + 86400000), // Expires in 24 hours
    });
  }
}

module.exports = new NotificationService();
