import express from 'express';
import { 
  getDashboardStats,
  updateOrderStatus,
  addProduct,
  updateProduct,
  deleteProduct
} from '../controllers/adminController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard', authenticate,isAdmin, getDashboardStats);
router.patch('/orders/:orderId', authenticate,isAdmin, updateOrderStatus);
router.post('/products/addItem', authenticate,isAdmin, addProduct); 
router.patch('/products/:productId', authenticate,isAdmin, updateProduct)
router.delete('/products/:productId', authenticate,isAdmin, deleteProduct)


export default router;