const app = require('./app');
const http = require('http');
const connectDB = require('./config/db');
const config = require('./config/env');
const { initializeSocket } = require('./socket');
const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Connect to database
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

// Start notification scheduler
startNotificationScheduler();

// Start server
server.listen(config.port, () => {
  console.log(`🚀 Server running in ${config.env} mode on port ${config.port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  stopNotificationScheduler();
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  stopNotificationScheduler();
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
