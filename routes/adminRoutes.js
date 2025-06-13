import express from 'express';
import { 
  getDashboardStats,
  updateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/adminController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import multer from 'multer';
// import upload from '../utils/Cloudinary.js'; // Assuming you have a Cloudinary setup for image uploads



const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard',  getDashboardStats);
router.patch('/orders/:orderId',  updateOrderStatus);


// Product Management
// Apply upload.single('image') middleware to handle file uploads
router.post('/products', createProduct);        // Route for creating a new product
router.put('/products/:productId', updateProduct); // Route for updating an existing product
router.delete('/products/:productId', deleteProduct); // Route for deleting a product


export default router;