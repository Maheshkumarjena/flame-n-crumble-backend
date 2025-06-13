import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { redisClient } from '../utils/cache.js';
import fs from 'fs'; // For file system operations (deleting old images)
import path from 'path'; // For path manipulation
import { fileURLToPath } from 'url'; // For ES Modules path resolution

const PRODUCTS_CACHE_KEY = 'products'; 

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
 * @route POST /api/admin/products
 * @access Private/Admin
 */
export const createProduct = async (req, res, next) => {
  try {
    // Multer will populate req.body with text fields and req.file with file info
    const { name, description, price, category, stock, bestseller, isNew } = req.body;
    const imagePath = req.file ? `/images/${req.file.filename}` : ''; // Store relative path

    const product = new Product({
      name,
      description,
      price: parseFloat(price), // Ensure numbers are parsed
      category,
      stock: parseInt(stock),   // Ensure numbers are parsed
      image: imagePath,
      bestseller: bestseller === 'true', // Convert string 'true'/'false' to boolean
      isNew: isNew === 'true',           // Convert string 'true'/'false' to boolean
    });

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
    const { productId } = req.params;
    // req.body contains the updated fields (text fields parsed by multer)
    // req.file contains the new image file (if uploaded)
    const { name, description, price, category, stock, bestseller, isNew, image: existingImagePath } = req.body; // 'image' here refers to the *existing* path sent from frontend

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
    product.name = name;
    product.description = description;
    product.price = parseFloat(price);
    product.category = category;
    product.stock = parseInt(stock);
    product.bestseller = bestseller === 'true';
    product.isNew = isNew === 'true';

    // Handle image update logic
    if (req.file) {
      // If a new image was uploaded:
      // 1. Delete the old image file from the public/images directory if it exists
      if (product.image) {
        const oldImagePath = path.join(PUBLIC_IMAGES_DIR, path.basename(product.image));
        fs.unlink(oldImagePath, (unlinkErr) => {
          if (unlinkErr && unlinkErr.code !== 'ENOENT') { // ENOENT means file not found, which is fine
            console.error('Error deleting old product image:', unlinkErr);
          }
        });
      }
      // 2. Update product.image with the path to the new image
      product.image = `/images/${req.file.filename}`;
    } else if (existingImagePath === '' && product.image) {
      // If frontend explicitly sent an empty string for 'image' and product had an image, delete it
      const oldImagePath = path.join(PUBLIC_IMAGES_DIR, path.basename(product.image));
      fs.unlink(oldImagePath, (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.error('Error deleting old product image on clear request:', unlinkErr);
        }
      });
      product.image = ''; // Clear image path in DB
    } 
    // If no new file and existingImagePath was not an empty string, means no change to image.
    // product.image retains its value (from DB or `existingImagePath` if it was sent).

    await product.save(); // Save the updated product
    
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
