import mongoose from "mongoose";

const otpVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    // Store registration data temporarily (optional for password reset)
    userData: {
      name: {
        type: String,
      },
      password: {
        type: String,
      },
      phone: String,
      role: {
        type: String,
        enum: ["customer", "organizer", "admin"],
        default: "customer",
      },
    },
    // Purpose: 'registration' or 'password-reset'
    purpose: {
      type: String,
      enum: ["registration", "password-reset"],
      default: "registration",
    },
    // OTP expires after 10 minutes
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - automatically delete expired documents
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
otpVerificationSchema.index({ email: 1, verified: 1 });

// Generate random 6-digit OTP
otpVerificationSchema.statics.generateOTP = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const OTPVerification = mongoose.model(
  "OTPVerification",
  otpVerificationSchema
);

export default OTPVerification;
