const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private (Auth required)
 */
const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

/**
 * @desc    Update user profile
 * @route   PATCH /api/users/me
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  
  const updateFields = {};
  if (name) updateFields.name = name;
  if (avatar !== undefined) updateFields.avatar = avatar;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateFields,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
});

/**
 * @desc    Change user password
 * @route   POST /api/users/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide current and new password',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters',
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect',
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * @desc    Delete user account
 * @route   DELETE /api/users/me
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your password to confirm deletion',
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Password is incorrect',
    });
  }

  // Delete user
  await User.findByIdAndDelete(req.user._id);

  // TODO: Clean up related data (boards, plans, subscriptions, etc.)

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
