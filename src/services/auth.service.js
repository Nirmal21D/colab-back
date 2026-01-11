const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

/**
 * Register a new user
 * @param {Object} data - User registration data
 * @returns {Object} - User object and tokens
 */
const registerUser = async (data) => {
  const { name, email, password } = data;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password,
  });

  // Generate tokens
  const payload = { 
    id: user._id, 
    email: user.email, 
    role: user.role 
  };
  
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Return sanitized user and tokens
  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

/**
 * Login user
 * @param {String} email - User email
 * @param {String} password - User password
 * @returns {Object} - User object and tokens
 */
const loginUser = async (email, password) => {
  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401);
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens
  const payload = { 
    id: user._id, 
    email: user.email, 
    role: user.role 
  };
  
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Return sanitized user and tokens
  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using refresh token
 * @param {String} refreshToken - JWT refresh token
 * @returns {Object} - New access and refresh tokens
 */
const refreshTokens = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 401);
    }

    // Generate new tokens
    const payload = { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    };
    
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(error.message || 'Invalid refresh token', 401);
  }
};

/**
 * Request password reset
 * @param {String} email - User email
 * @returns {Object} - Success message
 */
const forgotPassword = async (email) => {
  if (!email) {
    throw new AppError('Please provide email address', 400);
  }

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if user exists for security
    return {
      message: 'If an account with that email exists, we sent a password reset link',
    };
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token before storing in database
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Save hashed token and expiry (1 hour)
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  // Send email with unhashed token
  try {
    await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);
  } catch (error) {
    // If email fails, clear token from database
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    
    console.error('Email sending failed:', error);
    throw new AppError('Failed to send password reset email. Please try again.', 500);
  }

  return {
    message: 'Password reset link sent to your email',
  };
};

/**
 * Reset password with token
 * @param {String} token - Reset token from email
 * @param {String} newPassword - New password
 * @returns {Object} - Success message
 */
const resetPassword = async (token, newPassword) => {
  if (!token || !newPassword) {
    throw new AppError('Token and new password are required', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  // Hash the token from URL to compare with database
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid token and not expired
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Update password (will be hashed by pre-save middleware)
  user.password = newPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  // Send confirmation email
  try {
    await emailService.sendPasswordResetConfirmation(user.email, user.name);
  } catch (error) {
    console.error('Confirmation email failed:', error);
    // Don't throw error, password is already reset
  }

  return {
    message: 'Password reset successful',
  };
};

module.exports = {
  registerUser,
  loginUser,
  refreshTokens,
  forgotPassword,
  resetPassword,
};
