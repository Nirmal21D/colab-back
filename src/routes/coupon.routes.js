const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middleware/adminAuth');
const couponController = require('../controllers/coupon.controller');

// ============= PUBLIC ROUTES =============

// Validate a coupon (requires auth to check user-specific limits)
router.post('/validate', protect, couponController.validateCoupon);

// Get public coupon info by code
router.get('/:code', couponController.getCouponInfo);

// ============= ADMIN ROUTES =============

// Create a new coupon
router.post('/admin', protect, isAdmin, couponController.createCoupon);

// Bulk create coupons
router.post('/admin/bulk', protect, isAdmin, couponController.bulkCreateCoupons);

// Get campaign statistics
router.get('/admin/campaign/:campaign/stats', protect, isAdmin, couponController.getCampaignStats);

// Get all coupons
router.get('/admin', protect, isAdmin, couponController.getAllCoupons);

// Get coupon by ID
router.get('/admin/:id', protect, isAdmin, couponController.getCouponById);

// Get coupon statistics
router.get('/admin/:id/stats', protect, isAdmin, couponController.getCouponStats);

// Update a coupon
router.put('/admin/:id', protect, isAdmin, couponController.updateCoupon);

// Deactivate a coupon
router.post('/admin/:id/deactivate', protect, isAdmin, couponController.deactivateCoupon);

// Delete a coupon
router.delete('/admin/:id', protect, isAdmin, couponController.deleteCoupon);

module.exports = router;
