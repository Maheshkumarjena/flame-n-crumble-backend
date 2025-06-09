import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import errorHandler from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js'; // Assuming you have a wishlistRoutes.js
import orderRoutes from './routes/orderRoutes.js'; // Assuming you have an orderRoutes.js
import adminRoutes from './routes/adminRoutes.js'; // Assuming you have an adminRoutes.js

const app = express();


// Middleware
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

// Database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes); // Assuming you have a wishlistRoutes.js
app.use('/api/orders', orderRoutes); // Assuming you have an orderRoutes.js
app.use('/api/admin', adminRoutes); // Assuming you have an adminRoutes.js
// app.use('/api/addresses', addressRoutes); // <-- NEW: Use address routes here

// Error Handling
app.use(errorHandler);

export default app;