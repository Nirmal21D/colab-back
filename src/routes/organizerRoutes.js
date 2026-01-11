import express from 'express';
import { getOrganizerStats } from '../controllers/organizerController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require organizer authorization
router.use(protect, authorize('organizer'));

router.get('/stats', getOrganizerStats);

export default router;
