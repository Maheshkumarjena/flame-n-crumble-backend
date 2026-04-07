import Order from '../models/Order.js';
import User from '../models/User.js';
import { redisClient, clearAllProductRelatedCache } from '../utils/cache.js';
import Product from '../models/Product.js';
import fs from 'fs';
import path from 'path';

const PUBLIC_IMAGES_DIR = 'public/images';
const PRODUCTS_CACHE_KEY = 'products';
const USERS_CACHE_KEY = 'users';

/**
 * @desc Get dashboard statistics for admin
 * @route GET /api/admin/dashboard
 * @access Private/Admin
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const CACHE_KEY = 'dashboard:stats';
    
    // Check cache first - dashboard stats don't need real-time updates
    const cachedStats = await redisClient.get(CACHE_KEY);
    if (cachedStats) {
      return res.json(JSON.parse(cachedStats));
    }

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

    const stats = {
      totalOrders,
      totalProducts,
      totalUsers,
      recentOrders
    };

    // Cache for 5 minutes (300 seconds) - dashboard doesn't need real-time data
    await redisClient.setEx(CACHE_KEY, 300, JSON.stringify(stats));

    res.json(stats);
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
    const { status } = req.body; // The new status for the order
    const cacheKey = `order:${orderId}`;

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

    await product.save();
    
    // Clear all product-related cache keys to ensure fresh data
    await clearAllProductRelatedCache();
    
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
    const { productId } = req.params;
    // req.body contains the updated fields (text fields parsed by multer)
    // req.file contains the new image file (if uploaded)
    const { name, description, price, category, stock, bestseller, isNew, image } = req.body; // 'image' here refers to the *existing* path sent from frontend

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
    
    // Clear all product-related cache keys to ensure fresh data
    await clearAllProductRelatedCache();
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

    // Clear all product-related cache keys to ensure fresh data
    await clearAllProductRelatedCache();
    res.json({ message: 'Product deleted successfully' }); // Respond with a success message
  } catch (err) {
    next(err);
  }
};


/**
 * @desc Get all users (Admin only)
 * @route GET /api/admin/users?page=1&limit=20
 * @access Private/Admin
 */
export const getAllUsers = async (req, res, next) => {
  try {
    // Pagination parameters
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Get total count
    const total = await User.countDocuments({});
    
    // Check cache first
    const cacheKey = `${USERS_CACHE_KEY}:page:${page}:limit:${limit}`;
    const cachedUsers = await redisClient.get(cacheKey);
    
    if (cachedUsers) {
      return res.json(JSON.parse(cachedUsers));
    }

    // Fetch paginated users
    const users = await User.find({})
      .select('-password -verificationToken -verificationTokenExpires')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const response = {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache the results for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error('Error fetching all users:', error);
    next(error);
  }
};

/**
 * @desc Update a user's role (Admin only)
 * @route PATCH /api/admin/users/:userId/role
 * @access Private/Admin
 */
export const updateUserRole = async (req, res, next) => {
  try {

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
