// controllers/webhookController.js
import crypto from 'crypto';
import Order from '../models/Order.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { sendOrderConfirmationEmail } from '../utils/mailer.js';
/**
 * @desc Handle Razorpay webhook events
 * @route POST /api/webhooks/razorpay
 * @access Public (but protected by signature verification)
 */
export const razorpayWebhook = async (req, res) => {
  // Razorpay sends the webhook payload as raw body, not JSON.
  // We need to access the raw body for signature verification.
  // This requires `express.raw({ type: 'application/json' })` middleware for this route.
  const signature = req.headers['x-razorpay-signature'];
  const body = req.rawBody; // The raw body buffer from express.raw()

  if (!signature) {
    logger.warn('Razorpay webhook received without signature header.');
    return res.status(400).json({ error: 'Webhook signature missing.' });
  }

  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    logger.error('RAZORPAY_WEBHOOK_SECRET is not configured.');
    return res.status(500).json({ error: 'Webhook secret not configured on server.' });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(body) // Use the raw body for signature verification
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Razorpay webhook: Invalid signature received.');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Parse the body as JSON ONLY after signature verification
    const event = JSON.parse(body.toString());

    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;

      // Find the order by razorpayOrderId and update its status
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        {
          razorpayPaymentId: payment.id,
          isPaid: true,
          paidAt: new Date(),
          paymentResult: {
            id: payment.id,
            status: payment.status,
            update_time: new Date().toISOString(),
            email_address: payment.email, // Use email from payment entity
          },
          status: 'processing', // Mark order as processing after successful payment
          razorpaySignature: signature, // Store the verified signature
        },
        { new: true } // Return the updated document
      ).populate('user', 'name email') // Populate user to send email
       .populate('orderItems.product', 'name image'); // Populate product name/image for email details

      if (order) {
        logger.info(`Order ${order._id} updated to processing. Payment ID: ${payment.id}`);
        // Send order confirmation email
        await sendOrderConfirmationEmail(order);
      } else {
        logger.warn(`Razorpay webhook: Order not found for Razorpay Order ID: ${payment.order_id}`);
      }
    } else {
      logger.info(`Razorpay webhook: Unhandled event received: ${event.event}`);
    }

    // Always respond with 200 OK to Razorpay to acknowledge receipt
    res.json({ received: true });

  } catch (error) {
    logger.error('Razorpay webhook processing error:', error);
    // Respond with 500 status for server errors to Razorpay, allowing retries
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
