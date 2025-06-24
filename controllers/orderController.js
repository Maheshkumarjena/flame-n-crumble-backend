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

