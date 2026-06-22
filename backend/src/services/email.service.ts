import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: { user: config.email.user, pass: config.email.pass },
  tls: { rejectUnauthorized: false },
});

function wrapEmail(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.8); margin: 5px 0 0; }
    .body { padding: 40px 30px; color: #333; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px 30px; text-align: center; color: #9ca3af; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>AdHub</h1>
    <p>Earn While You Watch</p>
  </div>
  <div class="body">
    <h2>${title}</h2>
    ${body}
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} AdHub. All rights reserved.</p>
    <p>AdHub.in | support@adhub.in</p>
  </div>
</div>
</body>
</html>
  `;
}

export const emailService = {
  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${config.app.url}/verify-email?token=${token}`;
    const html = wrapEmail(
      `Hello, ${name}!`,
      `
      <p>Welcome to AdHub! We're excited to have you on board.</p>
      <p>Please verify your email address to activate your account and start earning points by watching ads.</p>
      <a href="${verifyUrl}" class="btn">Verify Email Address</a>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p>If you didn't create an AdHub account, you can safely ignore this email.</p>
      `
    );

    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Verify your AdHub email',
      html,
    });
    logger.info(`Verification email sent to ${email}`);
  },

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${config.app.url}/reset-password?token=${token}`;
    const html = wrapEmail(
      'Password Reset Request',
      `
      <p>Hi ${name},</p>
      <p>We received a request to reset your AdHub password. Click the button below to create a new password:</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
      `
    );

    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Reset your AdHub password',
      html,
    });
  },

  async sendWithdrawalConfirmation(
    email: string,
    name: string,
    amount: string,
    method: string,
    reference: string
  ): Promise<void> {
    const html = wrapEmail(
      'Withdrawal Processed!',
      `
      <p>Hi ${name},</p>
      <p>Your withdrawal request has been processed successfully!</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Amount</td><td style="padding:8px;">₹${amount}</td></tr>
        <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Method</td><td style="padding:8px;">${method}</td></tr>
        <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Reference</td><td style="padding:8px;">${reference}</td></tr>
      </table>
      <p>Funds will be credited within 1-3 business days depending on your payment method.</p>
      `
    );

    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Your AdHub withdrawal is processed',
      html,
    });
  },

  async sendFraudAlert(email: string, name: string): Promise<void> {
    const html = wrapEmail(
      'Account Security Notice',
      `
      <p>Hi ${name},</p>
      <p>We've detected some unusual activity on your AdHub account. As a precaution, your account has been temporarily suspended for review.</p>
      <p>If you believe this is an error, please contact our support team at <a href="mailto:support@adhub.in">support@adhub.in</a>.</p>
      <p>We take account security seriously and will review your case within 24-48 hours.</p>
      `
    );

    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'AdHub Account Security Notice',
      html,
    });
  },
};
