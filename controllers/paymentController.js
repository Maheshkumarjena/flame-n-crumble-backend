import Order from '../models/Order.js';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { sendOrderConfirmationEmail } from '../utils/mailer.js';

/**
 * @desc Verify Razorpay payment
 * @route POST /api/payments/verify
 * @access Private
 */
export const verifyPayment = async (req, res, next) => {
  console.log('Entering verifyPayment function.===================================================================>');
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature} = req.body;
    const orderId = req.body.dbOrderId;
    console.log('Received payment verification request with data:', { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId });

    // Validate input
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      console.log('Missing required fields. Returning 400.');
      return res.status(400).json({ error: 'Missing required payment verification fields' });
    }

    // Find the order
    console.log(`Attempting to find order with ID: ${orderId}`);
    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`Order with ID ${orderId} not found. Returning 404.`);
      return res.status(404).json({ error: 'Order not found' });
    }
    console.log('Order found:', order._id);

    // Verify the signature
    console.log('Generating signature for verification...');
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    console.log('Generated Signature:', generatedSignature);
    console.log('Received Razorpay Signature:', razorpay_signature);


    if (generatedSignature !== razorpay_signature) {
      logger.warn(`Payment verification failed for order ${orderId} - Invalid signature.`);
      console.log('Signatures do not match. Returning 400.');
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
    console.log('Signature verification successful.');

    // Update order status
    console.log(`Updating order ${orderId} status to 'processing'...`);
    order.status = 'processing';
    order.paymentDetails = {
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      signature: razorpay_signature,
      method: 'Razorpay',
      paidAt: new Date()
    };

    await order.save();
    console.log(`Order ${orderId} updated successfully with payment details **************************************************>`, order);

    // Send confirmation email
    console.log(`Populating order ${order._id} for email confirmation...`);
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email')
      .populate('items.product', 'name image');
    console.log('Order populated. Sending confirmation email------------------------------------------------->' , populatedOrder);
    await sendOrderConfirmationEmail(populatedOrder);
    console.log('Order confirmation email sent.');

    console.log('Payment verified successfully. Returning 200.');
    res.json({
      message: 'Payment verified successfully',
      order: populatedOrder
    });

  } catch (error) {
    logger.error('Payment verification error:', error);
    console.error('Error in verifyPayment function:', error);
    next(error);
  } finally {
    console.log('Exiting verifyPayment function.');
  }
};

/**
 * @desc Get Razorpay API key
 * @route GET /api/payments/key
 * @access Private
 */
export const getRazorpayKey = (req, res) => {
  console.log('Entering getRazorpayKey function.');
  console.log('Returning Razorpay Key ID.');
  res.json({ key: process.env.RAZORPAY_KEY_ID });
  console.log('Exiting getRazorpayKey function.');
};