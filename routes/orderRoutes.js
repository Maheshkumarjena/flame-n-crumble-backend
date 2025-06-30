import express from 'express';
import { 
  createOrder, 
  getOrderHistory,
  getOrderDetails ,

} from '../controllers/orderController.js';
import { verifyPayment, getRazorpayKey } from '../controllers/paymentController.js';

import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrderHistory);
router.get('/:orderId', getOrderDetails);

// Payment routes
router.post('/payments/verify',verifyPayment);

router.route('/payments/key',getRazorpayKey);

export default router;