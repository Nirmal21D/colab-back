const cron = require('node-cron');
const StudyTask = require('../models/StudyTask');
const notificationService = require('../services/notification.service');
const { getIO } = require('../socket');
const { emitNotificationToUser } = require('../socket/notificationNamespace');

/**
 * Notification Scheduler
 * Cron jobs for automated notifications
 */

/**
 * Check for tasks due soon (next hour)
 * Runs every 15 minutes
 */
const checkTasksDueSoon = cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('📋 Checking for tasks due soon...');

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find tasks due in the next hour that haven't been completed
    const tasks = await StudyTask.find({
      scheduledDate: {
        $gte: now,
        $lte: oneHourFromNow,
      },
      status: { $nin: ['completed', 'skipped'] },
    }).populate('userId', 'name email');

    console.log(`Found ${tasks.length} tasks due soon`);

    for (const task of tasks) {
      // Check if notification already sent (you might want to add a flag to prevent duplicates)
      const notification = await notificationService.notifyTaskDueSoon(
        task.userId._id || task.userId,
        task
      );

      // Emit real-time notification
      try {
        const io = getIO();
        emitNotificationToUser(io, task.userId._id || task.userId, notification);
      } catch (err) {
        console.error('Failed to emit real-time notification:', err);
      }
    }
  } catch (error) {
    console.error('Error checking tasks due soon:', error);
  }
});

/**
 * Check for overdue tasks
 * Runs every hour
 */
const checkOverdueTasks = cron.schedule('0 * * * *', async () => {
  try {
    console.log('⚠️ Checking for overdue tasks...');

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    // Find tasks that are overdue
    const tasks = await StudyTask.find({
      scheduledDate: { $lt: now },
      status: { $nin: ['completed', 'skipped'] },
    }).populate('userId', 'name email');

    console.log(`Found ${tasks.length} overdue tasks`);

    for (const task of tasks) {
      const notification = await notificationService.notifyTaskOverdue(
        task.userId._id || task.userId,
        task
      );

      // Emit real-time notification
      try {
        const io = getIO();
        emitNotificationToUser(io, task.userId._id || task.userId, notification);
      } catch (err) {
        console.error('Failed to emit real-time notification:', err);
      }
    }
  } catch (error) {
    console.error('Error checking overdue tasks:', error);
  }
});

/**
 * Send daily plan reminders
 * Runs every day at 8 AM
 */
const sendDailyPlanReminders = cron.schedule('0 8 * * *', async () => {
  try {
    console.log('🌅 Sending daily plan reminders...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all tasks scheduled for today
    const tasks = await StudyTask.find({
      scheduledDate: {
        $gte: today,
        $lt: tomorrow,
      },
      status: { $nin: ['completed', 'skipped'] },
    }).populate('userId', 'name email');

    // Group by user
    const tasksByUser = tasks.reduce((acc, task) => {
      const userId = task.userId._id?.toString() || task.userId.toString();
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(task);
      return acc;
    }, {});

    // Send notification to each user
    for (const [userId, userTasks] of Object.entries(tasksByUser)) {
      const notification = await notificationService.notifyDailyPlanReminder(
        userId,
        userTasks.length
      );

      // Emit real-time notification
      try {
        const io = getIO();
        emitNotificationToUser(io, userId, notification);
      } catch (err) {
        console.error('Failed to emit real-time notification:', err);
      }
    }

    console.log(`Sent reminders to ${Object.keys(tasksByUser).length} users`);
  } catch (error) {
    console.error('Error sending daily reminders:', error);
  }
});

/**
 * Send daily motivation quotes
 * Runs every day at 9 AM
 */
const sendDailyMotivation = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('💡 Sending daily motivation...');

    // Get all active users (you might want to query only active users)
    const User = require('../models/User');
    const users = await User.find({ isActive: true }).select('_id');

    for (const user of users) {
      const notification = await notificationService.notifyDailyMotivation(user._id);

      // Emit real-time notification
      try {
        const io = getIO();
        emitNotificationToUser(io, user._id, notification);
      } catch (err) {
        // Silent fail for motivation quotes
      }
    }

    console.log(`Sent motivation to ${users.length} users`);
  } catch (error) {
    console.error('Error sending daily motivation:', error);
  }
});

/**
 * Start all cron jobs
 */
const startNotificationScheduler = () => {
  console.log('🕐 Starting notification scheduler...');
  
  checkTasksDueSoon.start();
  checkOverdueTasks.start();
  sendDailyPlanReminders.start();
  sendDailyMotivation.start();

  console.log('✓ Notification scheduler started');
};

/**
 * Stop all cron jobs
 */
const stopNotificationScheduler = () => {
  checkTasksDueSoon.stop();
  checkOverdueTasks.stop();
  sendDailyPlanReminders.stop();
  sendDailyMotivation.stop();

  console.log('✗ Notification scheduler stopped');
};

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
};
