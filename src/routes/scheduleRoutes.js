import express from 'express';
import {
  getSchedule,
  updateWorkingHours,
  addDateOverride,
  removeDateOverride,
} from '../controllers/scheduleController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require organizer authorization
router.use(protect, authorize('organizer'));

router.get('/:appointmentId', getSchedule);
router.put('/:appointmentId/working-hours', updateWorkingHours);
router.post('/:appointmentId/overrides', addDateOverride);
router.delete('/:appointmentId/overrides/:date', removeDateOverride);

export default router;
