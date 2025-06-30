import crypto from 'crypto';
import Order from '../models/Order.js';
import { sendOrderConfirmationEmail } from '../utils/mailer.js';
import logger from '../utils/logger.js';

/**
 * @desc Handle Razorpay webhook events
 * @route POST /api/webhooks/razorpay
 * @access Public (protected by signature verification)
 */
export const razorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature) {
    logger.warn('Razorpay webhook called without signature');
    return res.status(400).json({ error: 'Signature missing' });
  }

  if (!webhookSecret) {
    logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());

    // Handle payment captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      
      // Find and update the order
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        {
          status: 'processing',
          paymentDetails: {
            paymentId: payment.id,
            orderId: payment.order_id,
            method: payment.method,
            amount: payment.amount / 100, // Convert from paise to INR
            paidAt: new Date(payment.created_at * 1000)
          }
        },
        { new: true }
      ).populate('user', 'name email')
       .populate('items.product', 'name image');

      if (order) {
        logger.info(`Order ${order._id} payment captured via webhook`);
        await sendOrderConfirmationEmail(order);
      } else {
        logger.warn(`Order not found for Razorpay order ID: ${payment.order_id}`);
      }
    }

    res.json({ success: true });

  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};