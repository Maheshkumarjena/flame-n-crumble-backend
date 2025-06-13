import express from 'express';
import { 
  getDashboardStats,
  updateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/adminController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/uploadMiddleware.js'; // Import the upload middleware

const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard',  getDashboardStats);
router.patch('/orders/:orderId',  updateOrderStatus);


// Product Management
// Apply upload.single('image') middleware to handle file uploads
router.post('/products', upload.single('image'), createProduct);        // Route for creating a new product
router.put('/products/:productId', upload.single('image'), updateProduct); // Route for updating an existing product
router.delete('/products/:productId', deleteProduct); // Route for deleting a product


export default router;