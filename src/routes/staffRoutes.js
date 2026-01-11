import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getStaff,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  toggleStaffStatus,
} from '../controllers/staffController.js';

const router = express.Router();

// All routes require authentication and organizer role
router.use(protect);
router.use(authorize('organizer', 'admin'));

router.route('/')
  .get(getStaff)
  .post(createStaffMember);

router.route('/:id')
  .get(getStaffMember)
  .put(updateStaffMember)
  .delete(deleteStaffMember);

router.patch('/:id/toggle-status', toggleStaffStatus);

export default router;
