import User from "../models/User.js";
import OTPVerification from "../models/OTPVerification.js";
import { generateToken } from "../middleware/auth.js";
import { asyncHandler, sendSuccess, sendError } from "../utils/helpers.js";
import {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../config/email.js";
import bcrypt from "bcryptjs";

/**
 * @desc    Register new user (Send OTP)
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    return sendError(res, "User already exists with this email", 400);
  }

  // Check if there's a pending OTP verification
  const existingOTP = await OTPVerification.findOne({
    email,
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (existingOTP) {
    return sendError(
      res,
      "OTP already sent to this email. Please check your inbox or wait for it to expire.",
      400
    );
  }

  // Hash password before storing
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Generate OTP
  const otp = OTPVerification.generateOTP();

  // Set expiry time (10 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Save OTP with user data
  await OTPVerification.create({
    email,
    otp,
    userData: {
      name,
      password: hashedPassword,
      phone,
      role: role || "customer",
    },
    expiresAt,
  });

  // Send OTP email
  try {
    await sendOTPEmail(email, name, otp);
  } catch (error) {
    // If email fails, delete the OTP record
    await OTPVerification.deleteOne({ email, verified: false });
    console.error("Email sending failed:", error);
    return sendError(
      res,
      "Failed to send verification email. Please try again.",
      500
    );
  }

  sendSuccess(
    res,
    {
      email,
      message: "OTP sent to your email",
      expiresIn: "10 minutes",
    },
    "Verification code sent successfully. Please check your email.",
    200
  );
});

/**
 * @desc    Verify OTP and create user account
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // Find OTP record
  const otpRecord = await OTPVerification.findOne({
    email,
    verified: false,
  });

  if (!otpRecord) {
    return sendError(res, "No verification request found for this email", 404);
  }

  // Check if OTP expired
  if (new Date() > otpRecord.expiresAt) {
    await otpRecord.deleteOne();
    return sendError(res, "OTP has expired. Please request a new one.", 400);
  }

  // Check maximum attempts (prevent brute force)
  if (otpRecord.attempts >= 5) {
    await otpRecord.deleteOne();
    return sendError(
      res,
      "Maximum verification attempts exceeded. Please request a new OTP.",
      400
    );
  }

  // Verify OTP
  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return sendError(
      res,
      `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`,
      400
    );
  }

  // OTP is valid - Create user account
  const user = new User({
    name: otpRecord.userData.name,
    email: otpRecord.email,
    password: otpRecord.userData.password,
    phone: otpRecord.userData.phone,
    role: otpRecord.userData.role,
    emailVerified: true,
  });

  // Skip password hashing since it's already hashed
  await user.save({ validateBeforeSave: true });

  // Mark OTP as verified and delete
  await otpRecord.deleteOne();

  // Send welcome email
  try {
    await sendWelcomeEmail(user.email, user.name);
  } catch (error) {
    console.error("Welcome email failed:", error);
    // Don't fail the registration if welcome email fails
  }

  // Generate token
  const token = generateToken(user._id);

  sendSuccess(
    res,
    {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    },
    "Email verified successfully. Account created!",
    201
  );
});

/**
 * @desc    Resend OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
export const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find existing OTP record
  const otpRecord = await OTPVerification.findOne({
    email,
    verified: false,
  });

  if (!otpRecord) {
    return sendError(res, "No pending verification found for this email", 404);
  }

  // Generate new OTP
  const otp = OTPVerification.generateOTP();

  // Update expiry time
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Update OTP record
  otpRecord.otp = otp;
  otpRecord.expiresAt = expiresAt;
  otpRecord.attempts = 0; // Reset attempts
  await otpRecord.save();

  // Send OTP email
  try {
    await sendOTPEmail(email, otpRecord.userData.name, otp);
  } catch (error) {
    console.error("Email sending failed:", error);
    return sendError(
      res,
      "Failed to send verification email. Please try again.",
      500
    );
  }

  sendSuccess(
    res,
    {
      email,
      message: "New OTP sent to your email",
      expiresIn: "10 minutes",
    },
    "Verification code resent successfully"
  );
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check for user
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return sendError(res, "Invalid credentials", 401);
  }

  // Check if password matches
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    return sendError(res, "Invalid credentials", 401);
  }

  if (!user.isActive) {
    return sendError(res, "Your account has been deactivated", 401);
  }

  // Generate token
  const token = generateToken(user._id);

  sendSuccess(
    res,
    {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    },
    "Login successful"
  );
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  sendSuccess(res, { user });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, organizerProfile } = req.body;

  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;

  if (req.user.role === "organizer" && organizerProfile) {
    user.organizerProfile = {
      ...user.organizerProfile,
      ...organizerProfile,
    };
  }

  await user.save();

  sendSuccess(res, { user }, "Profile updated successfully");
});

/**
 * @desc    Forgot password - Send OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not for security
    return sendSuccess(
      res,
      {
        email,
        message:
          "If an account exists with this email, a password reset code has been sent.",
      },
      "Password reset code sent successfully",
      200
    );
  }

  // Check if there's a pending OTP verification for password reset
  const existingOTP = await OTPVerification.findOne({
    email,
    verified: false,
    expiresAt: { $gt: new Date() },
    purpose: "password-reset",
  });

  if (existingOTP) {
    return sendError(
      res,
      "OTP already sent to this email. Please check your inbox or wait for it to expire.",
      400
    );
  }

  // Generate OTP
  const otp = OTPVerification.generateOTP();

  // Set expiry time (10 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Save OTP for password reset (userData not required for password reset)
  await OTPVerification.create({
    email,
    otp,
    userData: {
      name: user.name, // Store name for email personalization only
    },
    expiresAt,
    purpose: "password-reset",
  });

  // Send password reset OTP email
  try {
    await sendPasswordResetEmail(email, user.name, otp);
  } catch (error) {
    // If email fails, delete the OTP record
    await OTPVerification.deleteOne({
      email,
      verified: false,
      purpose: "password-reset",
    });
    console.error("Email sending failed:", error);
    return sendError(
      res,
      "Failed to send password reset email. Please try again.",
      500
    );
  }

  sendSuccess(
    res,
    {
      email,
      message:
        "If an account exists with this email, a password reset code has been sent.",
      expiresIn: "10 minutes",
    },
    "Password reset code sent successfully",
    200
  );
});

/**
 * @desc    Reset password with OTP
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  // Find OTP record for password reset
  const otpRecord = await OTPVerification.findOne({
    email,
    verified: false,
    purpose: "password-reset",
  });

  if (!otpRecord) {
    return sendError(
      res,
      "No password reset request found for this email",
      404
    );
  }

  // Check if OTP expired
  if (new Date() > otpRecord.expiresAt) {
    await otpRecord.deleteOne();
    return sendError(res, "OTP has expired. Please request a new one.", 400);
  }

  // Check maximum attempts
  if (otpRecord.attempts >= 5) {
    await otpRecord.deleteOne();
    return sendError(
      res,
      "Maximum verification attempts exceeded. Please request a new OTP.",
      400
    );
  }

  // Verify OTP
  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return sendError(
      res,
      `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`,
      400
    );
  }

  // OTP is valid - Update user password
  const user = await User.findOne({ email });

  if (!user) {
    await otpRecord.deleteOne();
    return sendError(res, "User not found", 404);
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  user.password = hashedPassword;
  await user.save();

  // Mark OTP as verified and delete
  await otpRecord.deleteOne();

  // Generate token for immediate login
  const token = generateToken(user._id);

  sendSuccess(
    res,
    {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    },
    "Password reset successfully. You are now logged in.",
    200
  );
});
