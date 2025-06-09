import nodemailer from 'nodemailer';
import { env } from '../config/env.js'; // Assuming you have your environment variables here
import logger from './logger.js'; // Assuming you have a logger utility

// Configure your email transporter for Brevo
// You'll get these details from your Brevo account (SMTP & API -> SMTP tab)
const transporter = nodemailer.createTransport({
  // Brevo's SMTP host
  host: env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com', // Typically 'smtp-relay.brevo.com' for Brevo
  // Brevo's SMTP port for secure TLS/STARTTLS connection
  port: env.BREVO_SMTP_PORT || 587, // Brevo commonly uses port 587 (TLS/STARTTLS)
  // 'secure' should be false for port 587 as it uses STARTTLS
  // If you were using port 465 (implicit SSL), it would be true.
  secure: false, // Use 'false' for STARTTLS on port 587
  auth: {
    // Your Brevo SMTP username (usually your Brevo account email)
    user: env.BREVO_SMTP_USERNAME,
    // Your Brevo SMTP password (API Key generated in Brevo under SMTP & API)
    pass: env.BREVO_SMTP_PASSWORD,
  },
});

/**
 * @desc Verifies the connection to the Brevo SMTP server.
 * It's good practice to call this once when your application starts
 * to ensure your email sending is configured correctly.
 */
transporter.verify(function (error, success) {
  if (error) {
    logger.error('Nodemailer: SMTP server connection failed for Brevo:', error);
    console.error('Nodemailer: SMTP server connection failed for Brevo:', error); // Also log to console for visibility
  } else {
    logger.info('Nodemailer: Successfully connected to Brevo SMTP server. Ready to send emails.');
    console.log('Nodemailer: Successfully connected to Brevo SMTP server. Ready to send emails.');
  }
});

/**
 * @desc Sends a verification email to the user using the configured Brevo transporter.
 * @param {string} to - The recipient's email address.
 * @param {string} code - The verification code to be included in the email.
 */
export const sendVerificationEmail = async (to, code) => {
  const subject = 'flame&crumble: Email Verification Code';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Email Verification</h2>
      <p>Thank you for registering with flame&crumble!</p>
      <p>Please use the following code to verify your email address:</p>
      <h3 style="background-color: #f0f0f0; padding: 10px; border-radius: 5px; display: inline-block; letter-spacing: 2px;">
        ${code}
      </h3>
      <p>This code is valid for 15 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Best regards,</p>
      <p>The flame&crumble Team</p>
    </div>
  `;
  const text = `
    Email Verification for flame&crumble\n\n
    Thank you for registering!
    Please use the following code to verify your email address: ${code}\n\n
    This code is valid for 15 minutes.\n\n
    If you did not request this, please ignore this email.\n\n
    Best regards,\n
    The flame&crumble Team
  `;

  const mailOptions = {
    // IMPORTANT: 'env.EMAIL_FROM' must be a sender email address you have verified in your Brevo account!
    // Otherwise, emails will fail to send.
    from: `flame&crumble <${env.EMAIL_FROM}>`, // Sender address
    to: to, // List of recipients
    subject: subject, // Subject line
    text: text, // Plain text body
    html: html, // HTML body
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${to}:`, error);
    // You might want to re-throw the error or handle it more gracefully depending on your application's needs.
    throw new Error('Failed to send verification email. Please try again.');
  }
};
