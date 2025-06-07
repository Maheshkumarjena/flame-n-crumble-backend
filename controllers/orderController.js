import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { redisClient } from '../utils/cache.js';

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
      return sum + (item.product.price * item.quantity);
    }, 0);

    // Create order
    const order = new Order({
      user: req.userId,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price
      })),
      total,
      shippingAddress,
      paymentMethod
    });

    await order.save();
    
    // Clear cart
    await Cart.deleteOne({ user: req.userId });
    await redisClient.del(`cart:${req.userId}`);
    
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

export const getOrderHistory = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json(orders);
  } catch (err) {
    next(err);
  }
};