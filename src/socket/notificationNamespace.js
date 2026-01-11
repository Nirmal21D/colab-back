const notificationService = require('../services/notification.service');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Notification Socket.IO Handler
 * Real-time notification delivery via WebSocket
 */

module.exports = (io) => {
  // Notification namespace
  const notificationNamespace = io.of('/notifications');

  // Add authentication middleware to namespace
  notificationNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;
      socket.user = { id: decoded.id, email: decoded.email, role: decoded.role };
      next();
    } catch (error) {
      console.error('Notification namespace auth error:', error.message);
      next(new Error('Invalid token'));
    }
  });

  notificationNamespace.on('connection', (socket) => {
    const userId = socket.user?.id;

    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log(`✓ User ${userId} connected to notifications`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Send initial unread count
    notificationService.getUnreadCount(userId).then((count) => {
      socket.emit('unread-count', { count });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`✗ User ${userId} disconnected from notifications`);
    });

    // Mark notification as read (real-time sync)
    socket.on('mark-as-read', async (data) => {
      try {
        await notificationService.markAsRead(data.notificationId, userId);
        const count = await notificationService.getUnreadCount(userId);
        socket.emit('unread-count', { count });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Mark all as read
    socket.on('mark-all-read', async () => {
      try {
        await notificationService.markAllAsRead(userId);
        socket.emit('unread-count', { count: 0 });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  });

  return notificationNamespace;
};

/**
 * Helper function to emit notification to user
 * Call this from other services/controllers
 */
const emitNotificationToUser = (io, userId, notification) => {
  const notificationNamespace = io.of('/notifications');
  notificationNamespace.to(`user:${userId}`).emit('new-notification', notification);
  
  // Also emit updated unread count
  notificationService.getUnreadCount(userId).then((count) => {
    notificationNamespace.to(`user:${userId}`).emit('unread-count', { count });
  });
};

module.exports.emitNotificationToUser = emitNotificationToUser;
