import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { redisClient } from '../utils/cache.js';
import Razorpay from 'razorpay'

const razorpay= new Razorpay({
  key_id:process.env.RAZORPAY_KEY_ID,
  key_secret:process.env.RAZORPAY_KEY_SECRET
});

const ORDER_CACHE_PREFIX = 'order:'; // New cache prefix for individual orders

/**
 * @desc Create a new order from user's cart
 * @route POST /api/orders
 * @access Private
 */
export const createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    
    // Get user's cart
    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate total
    const total = cart.items.reduce((sum, item) => {
      // Ensure product and price exist before summing
      return sum + (item.product ? item.product.price * item.quantity : 0);
    }, 0);


    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(variant.price * 100),
      currency: "USD",
      receipt: `receipt_${Date.now()}`,
      notes: {
        productId: productId.toString(),
      },
    });



    // order for database
    const newOrder = new Order({
      user: req.userId,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price // Store the price at the time of order
      })),
      total,
      shippingAddress,
      paymentMethod
    });



    await newOrder.save();
    
    // Clear cart after successful order creation
    await Cart.deleteOne({ user: req.userId });
    await redisClient.del(`cart:${req.userId}`); // Invalidate user's cart cache
    
    // Invalidate any order history cache for this user as a new order was added
    await redisClient.del(`${ORDER_CACHE_PREFIX}history:${req.userId}`);


    res.status(201).json({
       orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      dbOrderId: newOrder._id, 
    })


  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get user's order history (last 10 orders)
 * @route GET /api/orders
 * @access Private
 */
export const getOrderHistory = async (req, res, next) => {
  try {
    const cacheKey = `${ORDER_CACHE_PREFIX}history:${req.userId}`;
    const cachedOrders = await redisClient.get(cacheKey);

    if (cachedOrders) {
      return res.json(JSON.parse(cachedOrders));
    }

    const orders = await Order.find({ user: req.userId })
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(10) // Limit to last 10 orders for history
      .populate('items.product', 'name price image'); // Populate product details for items
    
    await redisClient.setEx(cacheKey, 600, JSON.stringify(orders)); // Cache for 10 minutes
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get details of a specific order
 * @route GET /api/orders/:orderId
 * @access Private
 */
export const getOrderDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const cacheKey = `${ORDER_CACHE_PREFIX}${orderId}`;

    const cachedOrder = await redisClient.get(cacheKey);
    if (cachedOrder) {
      return res.json(JSON.parse(cachedOrder));
    }

    // Find the order by ID and ensure it belongs to the authenticated user
    const order = await Order.findOne({ _id: orderId, user: req.userId }).populate('items.product', 'name price image');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(order)); // Cache for 1 hour
    res.json(order);
  } catch (err) {
    next(err);
  }
};



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


