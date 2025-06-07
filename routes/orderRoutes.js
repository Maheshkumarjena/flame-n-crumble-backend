import express from 'express';
import { 
  createOrder, 
  getOrderHistory,
  getOrderDetails 
} from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrderHistory);
router.get('/:orderId', getOrderDetails);

export default router;