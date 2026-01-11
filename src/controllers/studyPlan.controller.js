const studyPlanService = require('../services/studyPlan.service');
const { GamificationService } = require('../services/gamification.service');

class StudyPlanController {
  /**
   * Create study plan
   * POST /api/study-planner/plans
   */
  async createPlan(req, res, next) {
    try {
      const userId = req.user.id;
      console.log(`[StudyPlan] Creating plan for user ${userId}:`, req.body);
      
      const plan = await studyPlanService.createPlan(userId, req.body);
      
      console.log(`[StudyPlan] Plan created successfully:`, {
        id: plan.id || plan._id,
        title: plan.title,
        userId: plan.userId
      });

      // Award XP for plan creation
      let gamificationResult = null;
      try {
        gamificationResult = await GamificationService.awardPlanCreationXP(userId);
      } catch (gamError) {
        console.error('Error awarding plan creation XP:', gamError);
      }

      res.status(201).json({
        success: true,
        data: plan,
        gamification: gamificationResult,
      });
    } catch (error) {
      console.error('[StudyPlan] Error creating plan:', error.message);
      next(error);
    }
  }

  /**
   * Get all user plans
   * GET /api/study-planner/plans
   */
  async getPlans(req, res, next) {
    try {
      const userId = req.user.id;
      const { status, planType } = req.query;

      console.log('[getPlans] userId:', userId, 'filters:', { status, planType });

      const plans = await studyPlanService.getUserPlans(userId, {
        status,
        planType,
      });

      console.log('[getPlans] Found plans:', plans.length);

      res.json({
        success: true,
        count: plans.length,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get plan by ID
   * GET /api/study-planner/plans/:id
   */
  async getPlanById(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const { id } = req.params;

      const plan = await studyPlanService.getPlanById(id, userId, isAdmin);

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update plan
   * PUT /api/study-planner/plans/:id
   */
  async updatePlan(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const { id } = req.params;

      const plan = await studyPlanService.updatePlan(
        id,
        userId,
        req.body,
        isAdmin
      );

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete plan
   * DELETE /api/study-planner/plans/:id
   */
  async deletePlan(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const { id } = req.params;

      const result = await studyPlanService.deletePlan(id, userId, isAdmin);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get plan analytics
   * GET /api/study-planner/plans/:id/analytics
   */
  async getPlanAnalytics(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const { id } = req.params;

      const stats = await studyPlanService.getPlanAnalytics(
        id,
        userId,
        isAdmin
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user analytics
   * GET /api/study-planner/analytics
   */
  async getUserAnalytics(req, res, next) {
    try {
      const userId = req.user.id;
      const stats = await studyPlanService.getUserAnalytics(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudyPlanController();
