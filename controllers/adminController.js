import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { redisClient } from '../utils/cache.js';
import fs from 'fs'; // For file system operations (deleting old images)
import path from 'path'; // For path manipulation
import { fileURLToPath } from 'url'; // For ES Modules path resolution

const PRODUCTS_CACHE_KEY = 'products'; 
const USERS_CACHE_KEY = 'users'; // New cache key for all users

const ORDER_CACHE_PREFIX = 'order:'; // New cache prefix for individual orders

// Get __dirname equivalent in ES Modules for file deletion
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_IMAGES_DIR = path.join(__dirname, '../public/images');

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
  console.log('Updating order status for orderId:', );
  try {
    const { orderId } = req.params;
    const { status } = req.body; // The new status for the order
    const cacheKey = `${ORDER_CACHE_PREFIX}${orderId}`;

    // Define allowed statuses based on your schema enum
    const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    // Input validation for the status
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status provided. Allowed statuses are: ${allowedStatuses.join(', ')}`
      });
    }

    // Find the order by ID
    // For updating status, it's typically an admin action, so we don't filter by req.userId
    // If this were for a user to cancel their own order, you would add `user: req.userId`
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update the order status
    order.status = status;
    await order.save(); // Save the updated order to the database

    // Invalidate the cache for this specific order as its data has changed
    await redisClient.del(cacheKey);

    res.json({
      message: `Order status updated to '${status}' successfully.`,
      order: order // Return the updated order object
    });

  } catch (err) {
    // Pass the error to the next middleware for centralized error handling
    next(err);
  }
};



/**
 * @desc Create a new product (Admin only)
 * @route POST /api/admin/products
 * @access Private/Admin
 */
export const createProduct = async (req, res, next) => {
  try {
    // Multer will populate req.body with text fields and req.file with file info
    const { name, description, price, category, stock, bestseller, isNew , image } = req.body;

    console.log('req.body=======================================>', req.body);
    console.log("description at createProduct:", description);
    const product = new Product({
      name,
      description,
      price: parseFloat(price), // Ensure numbers are parsed
      category,
      stock: parseInt(stock),   // Ensure numbers are parsed
      image: image,
      bestseller: bestseller == true, // Convert string 'true'/'false' to boolean
      isNew: isNew == true,           // Convert string 'true'/'false' to boolean
    });

    console.log('Creating product---------------------------->', product);
    await product.save();
    
    // Invalidate the cache for all products so the new product appears
    await redisClient.del(PRODUCTS_CACHE_KEY); 
    res.status(201).json(product); // Respond with the newly created product
  } catch (err) {
    // If there's an error and a file was uploaded, delete it to prevent orphaned files
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
      });
    }
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
    console.log('update product called');
    const { productId } = req.params;
    // req.body contains the updated fields (text fields parsed by multer)
    // req.file contains the new image file (if uploaded)
    const { name, description, price, category, stock, bestseller, isNew, image } = req.body; // 'image' here refers to the *existing* path sent from frontend

    console.log('req.body:', req.body);
    const product = await Product.findById(productId);

    if (!product) {
      // If product not found and a new file was uploaded, delete it
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting orphaned uploaded file:', unlinkErr);
        });
      }
      return res.status(404).json({ error: 'Product not found' });
    }

    
    // Update product fields from req.body
    product.image = image;
    product.name = name;
    product.description = description;
    product.price = parseFloat(price);
    product.category = category;
    product.stock = parseInt(stock);
    product.bestseller = bestseller == true;
    product.isNew = isNew == true;
    

    // Handle image update logic
    // product.image retains its value (from DB or `existingImagePath` if it was sent).

    await product.save(); // Save the updated product
    console.log('Product updated:', product);
    
    // Invalidate the cache for all products as a product was modified
    await redisClient.del(PRODUCTS_CACHE_KEY); 
    res.json(product); // Respond with the updated product
  } catch (err) {
    // If there's an error during the update process and a new file was uploaded, delete it
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting uploaded file during update error:', unlinkErr);
      });
    }
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

    // Delete the associated image file from the public/images directory
    if (product.image) {
      const imageFilePath = path.join(PUBLIC_IMAGES_DIR, path.basename(product.image));
      fs.unlink(imageFilePath, (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') { // ENOENT means file not found, which is fine
          console.error('Error deleting product image file:', unlinkErr);
        }
      });
    }

    // Invalidate the cache for all products as a product was deleted
    await redisClient.del(PRODUCTS_CACHE_KEY); 
    res.json({ message: 'Product deleted successfully' }); // Respond with a success message
  } catch (err) {
    next(err);
  }
};


/**
 * @desc Get all users (Admin only)
 * @route GET /api/admin/users
 * @access Private/Admin
 */
export const getAllUsers = async (req, res, next) => {
  console.log("get all user triggered ")
  try {

    // Select all user fields except password and sensitive tokens
    const users = await User.find({}).select('-password -verificationToken -verificationTokenExpires');
    
    // Cache the users for a reasonable time (e.g., 5 minutes = 300 seconds)
    await redisClient.setEx(USERS_CACHE_KEY, 300, JSON.stringify(users));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching all users:', error);
    next(error); // Pass error to the error handling middleware
  }
};

/**
 * @desc Update a user's role (Admin only)
 * @route PATCH /api/admin/users/:userId/role
 * @access Private/Admin
 */
export const updateUserRole = async (req, res, next) => {
  try {

    console.log("request body====================",req.body)
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid user role provided. Must be "user" or "admin".' });
    }

    // Find user and update role
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent an admin from demoting themselves or the last admin
    // This is a crucial business logic check
    if (user.role === 'admin' && role === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(403).json({ error: 'Cannot demote the last admin user.' });
      }
      // Also prevent an admin from demoting themselves
      if (req.userId.toString() === userId) {
         return res.status(403).json({ error: 'Cannot demote your own account.' });
      }
    }


    user.role = role;
    await user.save();

    // Invalidate the users cache
    await redisClient.del(USERS_CACHE_KEY); 
    // If user details are also cached individually (e.g., `user:userId`), invalidate that too.
    await redisClient.del(`user:${userId}`); // Assuming a cache key like 'user:userId'

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    console.error(`Error updating user role for ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * @desc Delete a user (Admin only)
 * @route DELETE /api/admin/users/:userId
 * @access Private/Admin
 */
export const deleteUser = async (req, res, next) => {
  console.log('console log of request',req.body)

  try {
    const { userId } = req.params;

    // Prevent an admin from deleting themselves
    // if (req.admin.toString() === userId) {
    //   return res.status(403).json({ error: 'Cannot delete your own account.' });
    // }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If the user being deleted is an admin, ensure there's at least one other admin remaining
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(403).json({ error: 'Cannot delete the last admin user.' });
      }
    }

    await User.deleteOne({ _id: userId });

    // Invalidate the users cache
    // Invalidate any individual user cache

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(`Error deleting user ${req.params.userId}:`, error);
    next(error);
  }
};
