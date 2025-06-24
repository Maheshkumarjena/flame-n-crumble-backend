import express from 'express';
import { 
  createOrder, 
  getOrderHistory,
  getOrderDetails ,
  razorpayWebhook
} from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrderHistory);
router.get('/:orderId', getOrderDetails);
router.post('/razorpay', razorpayWebhook);

export default router;