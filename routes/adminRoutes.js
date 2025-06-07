import express from 'express';
import { 
  getDashboardStats,
  updateOrderStatus,
  manageProduct 
} from '../controllers/adminController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard', getDashboardStats);
router.patch('/orders/:orderId', updateOrderStatus);
router.post('/products', manageProduct);

export default router;