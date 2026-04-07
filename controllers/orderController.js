import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import { redisClient, clearAllProductRelatedCache } from "../utils/cache.js";
import Razorpay from "razorpay";
import Product from '../models/Product.js'; // Ensure correct import


console.log("Razorpay Key ID:::::::::::::", process.env.RAZORPAY_KEY_ID); // Debug
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ORDER_CACHE_PREFIX = "order:"; // New cache prefix for individual orders

/**
 * @desc Create a new order from user's cart
 * @route POST /api/orders
 * @access Private
 */


export const createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    // Get user's cart with populated products
    const cart = await Cart.findOne({ user: req.userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return next(new Error("Cart is empty", 400));
    }

    let subtotal = 0;
    const orderItemsForDb = [];

    // Validate stock and prepare order items
    for (const item of cart.items) {
      const product = item.product;
      console.log("product at the iteration of for loop to populate orderItems for db :::::::::::::::", product); // Debug

      if (!product) {
        return next(
          new CustomError(`Product not found for item in cart. ID: ${item._id}`, 404)
        );
      }

      if (product.stock < item.quantity) {
        return next(
          new CustomError(
            `Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            400
          )
        );
      }

      subtotal += product.price * item.quantity;

      orderItemsForDb.push({
        product: product._id,
        name: product.name,
        image: product.image,
        quantity: item.quantity,
        price: product.price,
      });

    }
    console.log("orderItemsForDb:::::::::::::::", orderItemsForDb); // Debug

    const shippingPrice = 250;
    const taxRate = 0.05;
    const taxPrice = subtotal * taxRate;
    const total = subtotal + shippingPrice + taxPrice;

    // Create order document
    const newOrder = new Order({
      user: req.userId,
      items: orderItemsForDb,
      shippingAddress,
      paymentMethod,
      shippingPrice,
      taxPrice,
      total,
      status: "pending",
    });

    await newOrder.save();

    // Deduct stock for all products using bulk operations (prevents N+1 queries)
    const bulkOps = cart.items.map(item => ({
      updateOne: {
        filter: { _id: item.product._id },
        update: { $inc: { stock: -item.quantity } }
      }
    }));
    
    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    // Clear product cache since stock has been modified
    await clearAllProductRelatedCache();

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(total * 100), // Razorpay requires amount in paise
      currency: "INR",
      receipt: `receipt_${newOrder._id.toString()}`,
      notes: {
        dbOrderId: newOrder._id.toString(),
        userId: req.userId.toString(),
      },
    });

    // Save Razorpay order ID
    newOrder.razorpayOrderId = order.id;
    await newOrder.save();

    // Clear cart
    await Cart.deleteOne({ user: req.userId });
    await redisClient.del(`cart:${req.userId}`);
    await redisClient.del(`${ORDER_CACHE_PREFIX}history:${req.userId}`);

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      dbOrderId: newOrder._id,
      totalAmount: total,
    });
  } catch (err) {
    console.error("Error creating order:", err);
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
    // Pagination parameters
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 per page
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await Order.countDocuments({ user: req.userId });
    
    const orders = await Order.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("items.product", "name price image");

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
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

    // Find the order by ID and ensure it belongs to the authenticated user
    const order = await Order.findOne({
      _id: orderId,
      user: req.userId,
    }).populate("items.product", "name price image");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};
