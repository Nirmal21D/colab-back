import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getSystemStats,
  getAllBookings,
  getAllAppointments,
  getAppointmentById,
  toggleAppointmentStatus,
  deleteAppointmentAsAdmin,
  getAnalyticsData,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin authorization
router.use(protect, authorize('admin'));

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/toggle-active', toggleUserStatus);

// System stats
router.get('/stats', getSystemStats);

// Bookings
router.get('/bookings', getAllBookings);

// Appointments
router.get('/appointments', getAllAppointments);
router.get('/appointments/:id', getAppointmentById);
router.patch('/appointments/:id/toggle-active', toggleAppointmentStatus);
router.delete('/appointments/:id', deleteAppointmentAsAdmin);

// Analytics & Reports
router.get('/analytics', getAnalyticsData);

export default router;
