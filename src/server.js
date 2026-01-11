import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDatabase from "./config/database.js";
import errorHandler from "./middleware/errorHandler.js";
import { startReservationCleanupJob } from "./utils/reservationCleanup.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import atomicBookingRoutes from "./routes/atomicBookingRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import organizerRoutes from "./routes/organizerRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import userManagementRoutes from "./routes/userManagementRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// Load environment variables
dotenv.config();

// Connect to database (non-blocking - server will start even if DB connection fails)
connectDatabase()
  .then(() => {
    // Start automatic cleanup job for expired reservations (IRCTC-style)
    startReservationCleanupJob();
  })
  .catch((err) => {
    console.error("Database connection failed on startup:", err.message);
    // Server will continue to start, but DB operations will fail
    // This allows the server to be started even if DB is temporarily unavailable
  });

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
if (process.env.NODE_ENV !== 'production') {
  // Development: allow all origins (makes local dev easier and fixes preflight for localhost)
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );
  app.options('*', cors());
  console.log('CORS: development mode - allowing all origins (for localhost)');
} else {
  // Production: restrict to configured origins
  const configuredOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean);
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error('CORS policy: This origin is not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Total-Count'],
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  console.log('CORS: production mode - allowed origins:', configuredOrigins);
}

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Increased for development
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later"
    });
  },
  skip: (req) => {
    // Skip rate limiting for GET requests to appointments and availability endpoints
    return (
      req.method === 'GET' && 
      (req.path.includes('/appointments/') || req.path.includes('/bookings/availability'))
    );
  },
});

app.use("/api/", limiter);

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/bookings", atomicBookingRoutes); // Atomic booking endpoints
app.use("/api/schedules", scheduleRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/users", userManagementRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/payments", paymentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

// Start server with error handling for port in use
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;

let server;
const startServer = (port) => {
  server = app.listen(port, () => {
    console.log(`\n🚀 Appointify Backend Server`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`🌐 Port: ${port}`);
    console.log(`🔗 URL: http://localhost:${port}`);
    console.log(`📊 Health: http://localhost:${port}/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
      // try next port
      setTimeout(() => startServer(port + 1), 200);
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  });
};

startServer(DEFAULT_PORT);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});

export default app;
