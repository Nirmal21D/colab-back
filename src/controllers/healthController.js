const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Health check endpoint
 * @route   GET /health
 * @access  Public
 */
const healthCheck = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

module.exports = {
  healthCheck,
};
