import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Check if SMTP is configured
const isSmtpConfigured = () => {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
};

// Development mode - log emails to console instead of sending
const isDevelopmentMode = () => {
  return process.env.NODE_ENV === "development" && "false" === "true";
};

// Create reusable transporter
const createTransporter = () => {
  if (!isSmtpConfigured()) {
    throw new Error(
      "SMTP configuration is missing. Please check your .env file."
    );
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

/**
 * Send email
 */
export const sendEmail = async (options) => {
  // Development mode - log to console instead of sending
  if (isDevelopmentMode()) {
    console.log("\n" + "=".repeat(60));
    console.log("📧 [DEV MODE] Email would be sent:");
    console.log("=".repeat(60));
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`\nContent:\n${options.text || "See HTML version"}`);
    console.log("=".repeat(60) + "\n");
    return { messageId: "dev-mode-" + Date.now() };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email sending error:", error.message);

    // Provide helpful error messages
    if (error.code === "ESOCKET" || error.code === "ECONNREFUSED") {
      throw new Error(
        `Failed to connect to SMTP server. Please check:\n` +
          `1. SMTP_HOST (${process.env.SMTP_HOST}) is correct\n` +
          `2. SMTP_PORT (${process.env.SMTP_PORT}) is correct\n` +
          `3. Your firewall allows connection to the SMTP server\n` +
          `4. For development, set SMTP_DEV_MODE=true in .env to log emails to console`
      );
    }

    if (error.code === "EAUTH") {
      throw new Error(
        `SMTP Authentication failed. Please check:\n` +
          `1. SMTP_USER is correct\n` +
          `2. SMTP_PASSWORD is correct\n` +
          `3. For Gmail, use App Password instead of regular password`
      );
    }

    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send OTP email
 */
export const sendOTPEmail = async (email, name, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .otp-box { background: white; border: 2px dashed #3B82F6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 8px; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Appointify!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for registering with Appointify. To complete your registration, please verify your email address using the OTP below:</p>
          
          <div class="otp-box">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Your verification code</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">This code will expire in 10 minutes</p>
          </div>
          
          <p><strong>Important:</strong> Do not share this OTP with anyone. Appointify staff will never ask for your verification code.</p>
          
          <p>If you didn't request this registration, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Appointify. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Appointify!

Hello ${name},

Thank you for registering with Appointify. Your verification code is: ${otp}

This code will expire in 10 minutes.

If you didn't request this registration, please ignore this email.

© ${new Date().getFullYear()} Appointify. All rights reserved.
  `;

  await sendEmail({
    to: email,
    subject: "Verify Your Email - Appointify",
    html,
    text,
  });
};

/**
 * Send welcome email after verification
 */
export const sendWelcomeEmail = async (email, name) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Email Verified Successfully!</h1>
        </div>
        <div class="content">
          <h2>Welcome to Appointify, ${name}!</h2>
          <p>Your email has been verified successfully. You can now enjoy all features of Appointify:</p>
          <ul>
            <li>Book appointments with ease</li>
            <li>Manage your bookings</li>
            <li>Get instant confirmations</li>
            <li>Access your booking history</li>
          </ul>
          <p>Start exploring and book your first appointment today!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Appointify. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Welcome to Appointify - Email Verified!",
    html,
    text: `Welcome to Appointify, ${name}! Your email has been verified successfully.`,
  });
};

/**
 * Send password reset OTP email
 */
export const sendPasswordResetEmail = async (email, name, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .otp-box { background: white; border: 2px dashed #EF4444; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #EF4444; letter-spacing: 8px; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password for your Appointify account. Use the OTP below to reset your password:</p>
          
          <div class="otp-box">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Your password reset code</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">This code will expire in 10 minutes</p>
          </div>
          
          <p><strong>Important:</strong> Do not share this OTP with anyone. Appointify staff will never ask for your verification code.</p>
          
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Appointify. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset Request - Appointify

Hello ${name},

We received a request to reset your password. Your password reset code is: ${otp}

This code will expire in 10 minutes.

If you didn't request a password reset, please ignore this email.

© ${new Date().getFullYear()} Appointify. All rights reserved.
  `;

  await sendEmail({
    to: email,
    subject: "Reset Your Password - Appointify",
    html,
    text,
  });
};

export default {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
