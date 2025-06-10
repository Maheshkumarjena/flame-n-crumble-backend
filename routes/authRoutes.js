import express from 'express';
import { 
  updateUserProfile,
  getAuthStatus,
  register, 
  login, 
  logout, 
  verifyEmail, // New import
  resendVerificationCode // New import
} from '../controllers/authController.js';
import { validateRegister, validateLogin } from '../middleware/validation.js';
import { apiLimiter } from '../middleware/rateLimit.js'; // Import rate limiter
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', apiLimiter, validateRegister, register); // Apply rate limiting to registration
router.post('/login', apiLimiter, validateLogin, login);     // Apply rate limiting to login
router.post('/logout', logout);

router.post('/verify-email', apiLimiter, verifyEmail); // New route for email verification
router.post('/resend-verification', apiLimiter, resendVerificationCode); // New route for resending code
router.put('/me', apiLimiter,updateUserProfile ); // New route for resending code

// routes/authRoutes.js (Add this new route)
router.get('/status', authenticate, getAuthStatus); // New route

export default router;
