import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { redisClient } from '../utils/cache.js';
import Razorpay from 'razorpay'

console.log("Razorpay Key ID:::::::::::::", process.env.RAZORPAY_KEY_ID); // Debug
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
    let total = cart.items.reduce((sum, item) => {
      // Ensure product and price exist before summing
      return sum + (item.product ? item.product.price * item.quantity : 0);
    }, 0);

    const deliveryCharge = 50;
    total += deliveryCharge; // Add delivery charge to the total

    // First, create the database order to get its _id
    // This allows us to use the dbOrderId in Razorpay notes for linking
    const newOrder = new Order({
      user: req.userId,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price // Store the price at the time of order
      })),
      total, // This total now includes delivery charge
      shippingAddress,
      paymentMethod,
      deliveryCharge // Store delivery charge in the order
    });

    
    await newOrder.save(); // Save to get the _id

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(total * 100), // Razorpay expects amount in paise (100 * INR)
      currency: "INR",
      receipt: `receipt_${newOrder._id.toString()}`, // Use newOrder._id as part of the receipt
      notes: {
        dbOrderId: newOrder._id.toString(), // Link to your internal order ID
        userId: req.userId.toString(),      // Optionally add user ID
        // You could also add a summary or a list of product IDs if needed, e.g.:
        // productNames: cart.items.map(item => item.product.name).join(', '),
        // productIds: cart.items.map(item => item.product._id.toString()).join(',')
      },
    });

    console.log("Razorpay Order Created:", order);
    

    // You might want to update the order with the Razorpay order ID here
    newOrder.razorpayOrderId = order.id; // Assuming you have a field for this in your Order model
    await newOrder.save();

    // Clear cart after successful order creation
    await Cart.deleteOne({ user: req.userId });
    await redisClient.del(`cart:${req.userId}`); // Invalidate user's cart cache
    
    // Invalidate any order history cache for this user as a new order was added
    await redisClient.del(`${ORDER_CACHE_PREFIX}history:${req.userId}`);

    res.status(201).json({
      orderId: order.id,        // Razorpay order ID
      amount: order.amount,     // Amount from Razorpay (in paise)
      currency: order.currency,
      dbOrderId: newOrder._id,  // Your database order ID
      totalAmount: total        // Total amount in your currency (INR)
    });

  } catch (err) {
    console.error("Error creating order:", err); // Log the error for debugging
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

