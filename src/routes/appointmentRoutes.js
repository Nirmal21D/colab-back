import express from 'express';
import { body } from 'express-validator';
import {
  createAppointment,
  getOrganizerAppointments,
  getPublicAppointments,
  getAppointment,
  getAppointmentBySlug,
  updateAppointment,
  deleteAppointment,
  togglePublish,
  getAppointmentSlots,
  generateShareToken,
  getAppointmentByShareToken,
  revokeShareToken,
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Validation rules
const appointmentValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('duration').isFloat({ min: 0.25 }).withMessage('Duration must be at least 0.25 hours'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
];

// Public routes
router.get('/public', getPublicAppointments);
router.get('/slug/:slug', getAppointmentBySlug);
router.get('/share/:token', getAppointmentByShareToken);
router.get('/:id/slots', getAppointmentSlots);

// Protected routes - Organizer only
router.post('/', protect, authorize('organizer'), appointmentValidation, validate, createAppointment);
router.get('/', protect, authorize('organizer'), getOrganizerAppointments);
router.get('/:id', protect, getAppointment);
router.put('/:id', protect, authorize('organizer'), updateAppointment);
router.delete('/:id', protect, authorize('organizer'), deleteAppointment);
router.post('/:id/share-token', protect, authorize('organizer'), generateShareToken);
router.delete('/:id/share-token', protect, authorize('organizer'), revokeShareToken);
router.patch('/:id/publish', protect, authorize('organizer'), togglePublish);

export default router;
