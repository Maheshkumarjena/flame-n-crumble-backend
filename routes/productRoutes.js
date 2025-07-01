import express from 'express';
import { getProducts , getBatchProducts } from '../controllers/productController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getProducts);
// router.post('/', authenticate, isAdmin, addProduct);
router.post('/batch', getBatchProducts); // Add this line


export default router;


