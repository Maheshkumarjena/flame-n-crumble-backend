import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { sendVerificationEmail } from '../utils/mailer.js'; // Import the mailer utility
import crypto from 'crypto'; // Node.js built-in module for generating random bytes
import logger from '../utils/logger.js'; // Import logger

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    logger.info(`Attempting to register user: ${email}`);

    // Check if user with this email already exists and is verified
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      logger.warn(`Registration failed: Email ${email} already registered and verified.`);
      return res.status(409).json({ error: 'Email already registered and verified.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let user;
    if (existingUser && !existingUser.isVerified) {
      // If user exists but not verified, update their record with new password/token
      logger.info(`Updating unverified user ${email} for re-registration.`);
      user = existingUser;
      user.name = name; // Update name in case it changed
      user.password = hashedPassword;
      user.isVerified = false; // Ensure it's false for re-verification
    } else {
      // Create a new user
      logger.info(`Creating new user: ${email}`);
      user = new User({ name, email, password: hashedPassword });
    }

    // Generate a 6-digit numeric verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Strictly 6-digit numeric
    
    // Hash the verification code before saving to the database
    const hashedVerificationToken = bcrypt.hashSync(verificationCode, 10);
    
    user.verificationToken = hashedVerificationToken;
    // Set token to expire in 15 minutes
    user.verificationTokenExpires = new Date(Date.now() + 15 * 60 * 1000); 

    await user.save();
    logger.info(`User ${user.email} saved to DB. Attempting to send verification email.`);

    // Send verification email (non-blocking)
    sendVerificationEmail(user.email, verificationCode)
      .catch(mailError => {
        // Log the actual mailer error for debugging but don't block the user registration response
        logger.error(`Error sending verification email to ${user.email}:`, mailError);
        // Do not block registration on email failure, but log it.
        // You might consider a separate retry mechanism for emails later.
      });

    // Do NOT send JWT token here. User must verify email first.
    // Instead, inform the client that verification is needed.
    res.status(201).json({ 
      message: 'Registration successful. Please check your email for a verification code.',
      userId: user._id // Optionally send userId to help with verification page
    });
  } catch (err) {
    if (err.code === 11000) { // MongoDB duplicate key error (for unique email)
      logger.error(`Registration failed: Email address ${req.body.email} already in use (MongoDB duplicate key error).`, err);
      return res.status(409).json({ error: 'Email address is already in use.' });
    }
    logger.error(`Registration failed for ${req.body.email}:`, err);
    next(err); // Pass error to the next error handling middleware
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    logger.info(`Attempting to log in user: ${email}`);

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logger.warn(`Login failed for ${email}: Invalid credentials.`);
      throw new Error('Invalid credentials');
    }

    // Prevent login if email is not verified
    if (!user.isVerified) {
      logger.warn(`Login failed for ${email}: Email not verified.`);
      return res.status(403).json({ error: 'Please verify your email to log in.' });
    }

    const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      sameSite: 'Lax' // Recommended for CSRF protection and better compatibility
    });
    logger.info(`User ${email} logged in successfully.`);
    res.json({ user: { id: user._id, name: user.name, email, role: user.role } }); // Include role
  } catch (err) {
    logger.error(`Login failed:`, err);
    next(err); // Pass error to the next error handling middleware
  }
};

export const logout = (req, res) => {
  logger.info('User attempting to log out.');
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax'
  });
  res.json({ message: 'Logged out' });
};

/**
 * @desc Verify user's email with a provided code
 * @route POST /api/auth/verify-email
 * @access Public
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    logger.info(`Attempting to verify email for: ${email} with code: ${code}`); // Debugging: log input

    const user = await User.findOne({ email });

    if (!user) {
      logger.warn(`Email verification failed: User not found for email ${email}.`);
      return res.status(404).json({ error: 'User not found.' });
    }
    logger.info(`User found for verification: ${user.email}, isVerified: ${user.isVerified}`); // Debugging: user status

    if (user.isVerified) {
      logger.warn(`Email verification failed for ${email}: Already verified.`);
      return res.status(400).json({ error: 'Email already verified.' });
    }

    // CORRECTED: Call compareVerificationToken as an instance method on the 'user' object
    const isCodeValid = await user.compareVerificationToken(code); 
    logger.info(`Verification code comparison result for ${email}: ${isCodeValid}`); // Debugging: comparison result

    // Check for token expiry
    const isTokenExpired = user.verificationTokenExpires < Date.now();
    logger.info(`Token expiry status for ${email}: Expired: ${isTokenExpired}, Expiry Date: ${user.verificationTokenExpires}`); // Debugging: expiry status

    if (!isCodeValid || isTokenExpired) {
      logger.warn(`Email verification failed for ${email}: Invalid or expired code. Valid: ${isCodeValid}, Expired: ${isTokenExpired}`);
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    // Mark user as verified and clear verification token fields
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    logger.info(`Email ${email} verified successfully. User data updated.`); // Debugging: success

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    logger.error(`Email verification failed:`, err);
    next(err); // Pass error to the next error handling middleware
  }
};

/**
 * @desc Resend email verification code
 * @route POST /api/auth/resend-verification
 * @access Public (user should be logged in but not verified, or public route for unverified users)
 */
export const resendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    logger.info(`Attempting to resend verification code for: ${email}`);

    const user = await User.findOne({ email });

    if (!user) {
      logger.warn(`Resend verification failed: User not found for email ${email}.`);
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.isVerified) {
      logger.warn(`Resend verification failed for ${email}: Email already verified.`);
      return res.status(400).json({ error: 'Email already verified.' });
    }

    // Generate a new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Strictly 6-digit numeric
    const hashedVerificationToken = bcrypt.hashSync(verificationCode, 10);
    
    user.verificationToken = hashedVerificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
    await user.save();
    logger.info(`New verification token generated and saved for ${email}. Attempting to resend email.`);

    // Send verification email
    await sendVerificationEmail(user.email, verificationCode);

    res.json({ message: 'New verification code sent to your email.' });
  } catch (err) {
    logger.error(`Error resending verification email to ${req.body.email}:`, err);
    // Be specific with the error message for the user if it's a known failure
    next(new Error('Failed to resend verification code. Please try again later.'));
  }
};


/**
 * @desc Check user authentication status
 * @route GET /api/auth/status
 * @access Private (will only succeed if authenticated)
 */
export const getAuthStatus = (req, res) => {
  // If this controller is reached, it means the `authenticate` middleware passed,
  // indicating the user is logged in via their JWT cookie.
  res.status(200).json({ loggedIn: true, userId: req.userId });
};



/**
 * @desc Update user profile information
 * @route PUT /api/auth/me
 * @access Private
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    // req.userId is set by the authentication middleware
    const user = await User.findById(req.userId);

    if (!user) {
      logger.warn(`User profile update failed: User not found for ID ${req.userId}.`);
      throw new CustomError('User not found.', 404);
    }

    const { name, phone } = req.body;

    // Update fields if provided and different
    if (name !== undefined && name !== user.name) {
      user.name = name;
      logger.info(`Updating user ${user.email} name to: ${name}`);
    }
    if (phone !== undefined && phone !== user.phone) {
      user.phone = phone;
      logger.info(`Updating user ${user.email} phone to: ${phone}`);
    }

    // Only save if any field has changed
    if (user.isModified('name') || user.isModified('phone')) {
      await user.save();
      logger.info(`User ${user.email} profile updated successfully.`);
      res.status(200).json({ 
        message: 'Profile updated successfully',
        user: { 
          id: user._id, 
          name: user.name, 
          email: user.email, 
          phone: user.phone,
          role: user.role // Include role in response
        } 
      });
    } else {
      logger.info(`No changes detected for user ${user.email} profile.`);
      res.status(200).json({ message: 'No changes to update', user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone,
        role: user.role
      } });
    }

  } catch (error) {
    logger.error(`Error updating user profile for user ${req.userId}:`, error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return next(new CustomError(messages.join(', '), 400));
    }
    next(error); // Pass error to the next error handling middleware
  }
};
