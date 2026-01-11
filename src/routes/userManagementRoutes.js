import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getTeamUsers,
  getTeamUser,
  createTeamUser,
  updateTeamUser,
  deleteTeamUser,
  toggleUserStatus,
} from '../controllers/userManagementController.js';

const router = express.Router();

// Public route for team/staff members (filtered by organizer)
router.get('/team', protect, getTeamUsers);

// All other routes require authentication and organizer role
router.use(protect);
router.use(authorize('organizer', 'admin'));

router.route('/users')
  .get(getTeamUsers)
  .post(createTeamUser);

router.route('/:id')
  .get(getTeamUser)
  .put(updateTeamUser)
  .delete(deleteTeamUser);

router.patch('/:id/toggle-status', toggleUserStatus);

export default router;
