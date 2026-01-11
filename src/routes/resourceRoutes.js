import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  toggleResourceStatus,
  getResourceStats,
} from '../controllers/resourceController.js';

const router = express.Router();

// All routes require authentication and organizer role
router.use(protect);
router.use(authorize('organizer', 'admin'));

router.route('/')
  .get(getResources)
  .post(createResource);

router.get('/stats', getResourceStats);

router.route('/:id')
  .get(getResource)
  .put(updateResource)
  .delete(deleteResource);

router.patch('/:id/toggle-status', toggleResourceStatus);

export default router;
