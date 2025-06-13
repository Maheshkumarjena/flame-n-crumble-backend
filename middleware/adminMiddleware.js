// middleware/adminMiddleware.js
import { CustomError } from './errorHandler.js'; // Assuming CustomError

export const adminProtect = (req, res, next) => {
  // req.user should be populated by your 'protect' middleware
  if (req.user && req.user.role === 'admin') {
    next(); // User is an admin, proceed
  } else {
    console.log('Admin access denied');
    next(new CustomError('Not authorized as an admin', 403)); // Forbidden
  }
};