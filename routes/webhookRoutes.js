// routes/webhookRoutes.js
import express from 'express';
import { razorpayWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Razorpay webhook route
// Important: This route needs to parse the raw body, not JSON.
// We will apply a specific middleware for this in server.js
router.post('/razorpay', razorpayWebhook);

export default router;
