import express from 'express';
import { getProducts, addProduct } from '../controllers/productController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getProducts);
router.post('/', authenticate, isAdmin, addProduct);

export default router;

// (Similarly, define cartRoutes.js, wishlistRoutes.js, etc.)

