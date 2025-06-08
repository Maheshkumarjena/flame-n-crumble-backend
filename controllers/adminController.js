import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { redisClient } from '../utils/cache.js';

// Cache key for all products, used to invalidate product listing cache
const PRODUCTS_CACHE_KEY = 'products'; 

/**
 * @desc Get dashboard statistics for admin
 * @route GET /api/admin/dashboard
 * @access Private/Admin
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    // Fetch counts of total orders, products, and users concurrently
    const [totalOrders, totalProducts, totalUsers] = await Promise.all([
      Order.countDocuments(),
      Product.countDocuments(),
      User.countDocuments()
    ]);

    // Fetch the 5 most recent orders, populating user details
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(5)
      .populate('user', 'name email'); // Populate only name and email for the user

    res.json({
      totalOrders,
      totalProducts,
      totalUsers,
      recentOrders
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update the status of a specific order
 * @route PATCH /api/admin/orders/:orderId
 * @access Private/Admin
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body; // New status from request body

    // Validate if the status is one of the allowed enums
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status provided' });
    }

    // Find and update the order by its ID, return the updated document
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true } // `new: true` returns updated doc, `runValidators` validates against schema
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Invalidate the cache for this specific order, if it was cached
    await redisClient.del(`order:${orderId}`);
    // Also invalidate the order history cache for relevant users if necessary (though this is more complex for all users)

    res.json(order);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Create a new product (Admin only)
 * @route POST /api/admin/addItem
 * @access Private/Admin
 */
export const addProduct = async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    await redisClient.del(PRODUCTS_CACHE_KEY); // Invalidate cache
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update an existing product (Admin only)
 * @route PUT /api/admin/products/:productId
 * @access Private/Admin
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const updateData = req.body; // Data to update, e.g., name, price, stock

    // Find and update the product by ID, return the updated document
    const product = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true } // `new: true` returns updated doc, `runValidators` validates against schema
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Invalidate the cache for all products as a product was modified
    await redisClient.del(PRODUCTS_CACHE_KEY); 
    res.json(product); // Respond with the updated product
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Delete a product (Admin only)
 * @route DELETE /api/admin/products/:productId
 * @access Private/Admin
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Find and delete the product by ID
    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Invalidate the cache for all products as a product was deleted
    await redisClient.del(PRODUCTS_CACHE_KEY); 
    res.json({ message: 'Product deleted successfully' }); // Respond with a success message
  } catch (err) {
    next(err);
  }
};
