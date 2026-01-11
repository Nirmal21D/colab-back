const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const studyPlanController = require('../controllers/studyPlan.controller');
const studyTaskController = require('../controllers/studyTask.controller');

// ============================================================================
// STUDY PLANS ROUTES
// ============================================================================

// Plans CRUD
router.post('/plans', protect, studyPlanController.createPlan);
router.get('/plans', protect, studyPlanController.getPlans);
router.get('/plans/:id', protect, studyPlanController.getPlanById);
router.put('/plans/:id', protect, studyPlanController.updatePlan);
router.delete('/plans/:id', protect, studyPlanController.deletePlan);

// Plan analytics
router.get('/plans/:id/analytics', protect, studyPlanController.getPlanAnalytics);
router.get('/analytics', protect, studyPlanController.getUserAnalytics);

// Plan tasks (nested route)
router.get('/plans/:planId/tasks', protect, studyTaskController.getPlanTasks);

// ============================================================================
// STUDY TASKS ROUTES
// ============================================================================

// Tasks CRUD
router.post('/tasks', protect, studyTaskController.createTask);
router.post('/tasks/bulk', protect, studyTaskController.createBulkTasks);
router.get('/tasks', protect, studyTaskController.getUserTasks);
router.get('/tasks/today', protect, studyTaskController.getTodayTasks);
router.get('/tasks/upcoming', protect, studyTaskController.getUpcomingTasks);
router.get('/tasks/overdue', protect, studyTaskController.getOverdueTasks);
router.get('/tasks/:id', protect, studyTaskController.getTaskById);
router.put('/tasks/:id', protect, studyTaskController.updateTask);
router.delete('/tasks/:id', protect, studyTaskController.deleteTask);

// Task actions
router.post('/tasks/:id/complete', protect, studyTaskController.completeTask);
router.post('/tasks/:id/reschedule', protect, studyTaskController.rescheduleTask);

module.exports = router;
