import express from "express";
import { body } from "express-validator";
import {
  register,
  login,
  getMe,
  updateProfile,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";

const router = express.Router();

// Validation rules
const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const verifyOTPValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
];

const resendOTPValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
];

const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
];

const resetPasswordValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

// Routes
router.post("/register", registerValidation, validate, register);
router.post("/verify-otp", verifyOTPValidation, validate, verifyOTP);
router.post("/resend-otp", resendOTPValidation, validate, resendOTP);
router.post("/login", loginValidation, validate, login);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  validate,
  forgotPassword
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  validate,
  resetPassword
);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

export default router;
