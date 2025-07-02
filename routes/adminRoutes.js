import express from 'express';
import { 
  getDashboardStats,
  updateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllUsers,
  updateUserRole,
  deleteUser,
  
} from '../controllers/adminController.js';

import { authenticate, isAdmin } from '../middleware/auth.js';

// import upload from '../utils/Cloudinary.js'; // Assuming you have a Cloudinary setup for image uploads



const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard',  getDashboardStats);
router.put('/orders/:orderId',  updateOrderStatus);


// Product Management
// Apply upload.single('image') middleware to handle file uploads
router.post('/products', createProduct);        // Route for creating a new product
router.put('/products/:productId', updateProduct); // Route for updating an existing product
router.delete('/products/:productId', deleteProduct); // Route for deleting a product
router.get('/users',getAllUsers)
router.patch('/users/:userId/role',updateUserRole)
router.delete('/users/:userId',deleteUser)
router.patch('/update/:orderId', updateOrderStatus); // Assuming this is for updating an order



export default router;