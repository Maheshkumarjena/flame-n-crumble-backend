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


export const sendOrderConfirmationEmail = async (order) => {
  const subject = `Order Confirmation - flame&crumble Order #${order._id.toString().slice(-6).toUpperCase()}`;
  
  const orderItemsHtml = order.items.map(item => `
    <li>
      <strong>${item.product.name}</strong> (Qty: ${item.quantity}) - ₹${item.price.toFixed(2)} each
    </li>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Thank You for Your Order!</h2>
      <p>Hi ${order.user.name},</p>
      <p>Your order with flame&crumble has been successfully placed and paid for. We're getting it ready!</p>
      
      <h3 style="color: #E30B5D;">Order #${order._id.toString().slice(-6).toUpperCase()}</h3>
      <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
      <p><strong>Payment Status:</strong> Paid</p>
      <p><strong>Total Amount:</strong> ₹${order.total.toFixed(2)}</p>

      <h4>Order Summary:</h4>
      <ul style="list-style-type: none; padding: 0;">
        ${orderItemsHtml}
      </ul>

      <h4>Shipping Address:</h4>
      <p>${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zip}</p>
      <p>${order.shippingAddress.country}</p>
      <p>You can view your order details anytime by logging into your account and visiting your <a href="${env.CLIENT_URL}/myorders" style="color: #E30B5D; text-decoration: none;">My Orders</a> page.</p>
      
      <p>Thank you for shopping with flame&crumble!</p>
      <p>Best regards,</p>
      <p>The flame&crumble Team</p>
    </div>
  `;

  const text = `
    Order Confirmation - flame&crumble Order #${order._id.toString().slice(-6).toUpperCase()}

    Thank You for Your Order!
    Hi ${order.user.name},

    Your order with flame&crumble has been successfully placed and paid for. We're getting it ready!

    Order ID: ${order._id}
    Order Date: ${new Date(order.createdAt).toLocaleDateString()}
    Payment Status: Paid
    Total Amount: ₹${order.total.toFixed(2)}

    Order Summary:
    ${order.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - ₹${item.price.toFixed(2)} each`).join('\n')}

    Shipping Address:
    ${order.shippingAddress.fullName}
    ${order.shippingAddress.line1}
    ${order.shippingAddress.line2 ? `${order.shippingAddress.line2}\n` : ''}${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zip}
    ${order.shippingAddress.country}
    Phone: ${order.shippingAddress.phone}

    You can view your order details anytime by logging into your account and visiting your My Orders page: ${env.FRONTEND_URL}/myorders

    Thank you for shopping with flame&crumble!
    Best regards,
    The flame&crumble Team
  `;

  const mailOptions = {
    from: `flame&crumble <${env.EMAIL_FROM}>`,
    to: order.user.email,
    subject: subject,
    text: text,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Order confirmation email sent to ${order.user.email} for order ${order._id}`);
  } catch (error) {
    logger.error(`Failed to send order confirmation email to ${order.user.email} for order ${order._id}:`, error);
    // Do not re-throw here as webhook should ideally succeed even if email fails
  }
};
