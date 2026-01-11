const nodemailer = require('nodemailer');
const config = require('../config/env');

/**
 * Email Service for sending emails using Nodemailer
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    try {
      // Create transporter based on environment
      if (config.email.service === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.email.user,
            pass: config.email.password,
          },
        });
      } else {
        // Generic SMTP configuration
        this.transporter = nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.secure, // true for 465, false for other ports
          auth: {
            user: config.email.user,
            pass: config.email.password,
          },
        });
      }

      console.log('✉️ Email service initialized');
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content (optional)
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      throw error;
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @param {string} name - User name
   * @param {string} resetToken - Password reset token
   */
  async sendPasswordResetEmail(email, name, resetToken) {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            padding: 40px;
            text-align: center;
          }
          .content {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-top: 20px;
          }
          h1 {
            color: white;
            margin: 0;
            font-size: 28px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Collabry</h1>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password for your Collabry account.</p>
            <p>Click the button below to reset your password:</p>
            
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0; padding-left: 20px; text-align: left;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password won't change until you create a new one</li>
              </ul>
            </div>
            
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              Or copy and paste this URL into your browser:<br/>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>© 2026 Collabry - AI Collaborative Study Platform</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Reset Your Collabry Password',
      html,
    });
  }

  /**
   * Send password reset confirmation email
   * @param {string} email - User email
   * @param {string} name - User name
   */
  async sendPasswordResetConfirmation(email, name) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            padding: 40px;
            text-align: center;
          }
          .content {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-top: 20px;
          }
          h1 {
            color: white;
            margin: 0;
            font-size: 28px;
          }
          .success-icon {
            font-size: 60px;
            color: #28a745;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Collabry</h1>
          <div class="content">
            <div class="success-icon">✓</div>
            <h2>Password Successfully Reset</h2>
            <p>Hi ${name},</p>
            <p>Your password has been successfully changed.</p>
            <p>You can now log in with your new password.</p>
            
            <a href="${config.frontendUrl}/login" class="button">Go to Login</a>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If you didn't make this change, please contact support immediately.
            </p>
          </div>
          
          <div class="footer">
            <p>© 2026 Collabry - AI Collaborative Study Platform</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Password Reset Successful - Collabry',
      html,
    });
  }

  /**
   * Verify email configuration
   */
  async verifyConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service verification failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
