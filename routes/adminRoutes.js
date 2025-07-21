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

const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard',  getDashboardStats);
router.put('/orders/:orderId',  updateOrderStatus);

// Product Management
router.post('/products', createProduct);
router.put('/products/:productId', updateProduct);
router.delete('/products/:productId', deleteProduct);
router.get('/users',getAllUsers)
router.patch('/users/:userId/role',updateUserRole)
router.delete('/users/:userId',deleteUser)
router.patch('/update/:orderId', updateOrderStatus);

export default router;