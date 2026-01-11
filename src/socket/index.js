const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {Object} httpServer - HTTP server instance
 */
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: config.cors.methods,
      allowedHeaders: config.cors.allowedHeaders
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use((socket, next) => {
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
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userEmail} (${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.userEmail} (${reason})`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.userEmail}:`, error);
    });
  });

  // Initialize board namespace
  require('./boardNamespace')(io);
  
  // Initialize chat namespace
  const { initializeChatNamespace } = require('./chatNamespace');
  initializeChatNamespace(io);

  // Initialize notification namespace
  require('./notificationNamespace')(io);

  console.log('🔌 Socket.IO initialized');
  return io;
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
