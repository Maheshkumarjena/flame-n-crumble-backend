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
  <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
  <!-- Header with brand colors -->
  <div style="background: linear-gradient(to right, #fda4af, #fb7185); padding: 30px 20px; text-align: center;">
    <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: white;">
      <span style="color: #fecdd3">flame</span>&<span style="color: #fecdd3">crumble</span>
    </h1>
  </div>
  
  <!-- Content -->
  <div style="padding: 30px;">
    <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; color: #111827; margin-top: 0; margin-bottom: 20px;">
      Email Verification
    </h2>
    
    <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">
      Thank you for registering with flame&crumble! We're excited to have you join our community of artisanal delight lovers.
    </p>
    
    <p style="font-size: 16px; color: #4b5563; margin-bottom: 10px;">
      Please use the following verification code:
    </p>
    
    <div style="background-color: #fff1f2; border: 1px solid #fda4af; border-radius: 8px; padding: 16px; text-align: center; margin: 25px 0; display: inline-block;">
      <h3 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 28px; color: #e11d48; letter-spacing: 4px;">
        ${code}
      </h3>
    </div>
    
    <p style="font-size: 14px; color: #9ca3af; margin-bottom: 25px;">
      This code is valid for 15 minutes.
    </p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 30px 0;">
      <p style="font-size: 14px; color: #64748b; margin: 0;">
        If you didn't request this verification, please ignore this email or contact our support team if you have any concerns.
      </p>
    </div>
    
    <p style="font-size: 16px; color: #4b5563; margin-bottom: 5px;">
      With warm regards,
    </p>
    <p style="font-size: 16px; color: #4b5563; margin-top: 0; font-weight: 600;">
      The flame&crumble Team
    </p>
  </div>
  
  <!-- Footer -->
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
      © 2023 flame&crumble | Handcrafted Delights
    </p>
  </div>
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
    <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
  <!-- Header with brand colors -->
  <div style="background: linear-gradient(to right, #fda4af, #fb7185); padding: 30px 20px; text-align: center;">
    <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: white;">
      <span style="color: #fecdd3">flame</span>&<span style="color: #fecdd3">crumble</span>
    </h1>
    <p style="color: white; font-size: 18px; margin: 8px 0 0;">Order Confirmation</p>
  </div>
  
  <!-- Content -->
  <div style="padding: 30px;">
    <div style="background: #fff1f2; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="font-size: 16px; color: #4b5563; margin: 0 0 10px;">Hi ${order.user.name},</p>
      <p style="font-size: 16px; color: #4b5563; margin: 0;">Your order has been confirmed and we're preparing it with care!</p>
    </div>

    <!-- Order Summary Card -->
    <div style="border: 1px solid #fecdd3; border-radius: 10px; padding: 0; overflow: hidden; margin-bottom: 25px;">
      <div style="background: #fff1f2; padding: 15px 20px;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 20px; color: #111827; margin: 0;">
          Order #${order._id.toString().slice(-6).toUpperCase()}
        </h2>
      </div>
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b;">Order Date : </span>
          <span style="font-weight: 500;">${new Date(order.createdAt).toLocaleDateString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b;">Payment Status : </span>
          <span style="color: #10b981; font-weight: 500;">Paid</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b;">Total Amount : </span>
          <span style="font-weight: 700; color: #e11d48;">₹${order.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Order Items -->
    <h3 style="font-family: 'Playfair Display', serif; font-size: 18px; color: #111827; margin-bottom: 15px; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px;">
      Your Items
    </h3>
    <div style="margin-bottom: 25px;">
      ${orderItemsHtml}
    </div>

    <!-- Shipping Address -->
    <h3 style="font-family: 'Playfair Display', serif; font-size: 18px; color: #111827; margin-bottom: 15px; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px;">
      Shipping To
    </h3>
    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 25px;">
      <p style="margin: 0 0 8px; font-weight: 500;">${order.shippingAddress.line1}</p>
      ${order.shippingAddress.line2 ? `<p style="margin: 0 0 8px;">${order.shippingAddress.line2}</p>` : ''}
      <p style="margin: 0 0 8px;">${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zip}</p>
      <p style="margin: 0;">${order.shippingAddress.country}</p>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${env.CLIENT_URL}/orders/${order._id}" style="background: #fb7185; color: white; text-decoration: none; padding: 12px 24px; border-radius: 50px; font-weight: 500; display: inline-block; transition: all 0.3s ease;" 
         onmouseover="this.style.background='#e11d48'" 
         onmouseout="this.style.background='#fb7185'">
        View Your Order
      </a>
    </div>

    <p style="font-size: 16px; color: #4b5563; text-align: center; margin-bottom: 5px;">
      Thank you for choosing flame&crumble!
    </p>
    <p style="font-size: 14px; color: #9ca3af; text-align: center; margin-top: 0;">
      We appreciate your support of our handcrafted delights.
    </p>
  </div>
  
  <!-- Footer -->
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
      © ${new Date().getFullYear()} flame&crumble | Handcrafted Delights
    </p>
  </div>
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



