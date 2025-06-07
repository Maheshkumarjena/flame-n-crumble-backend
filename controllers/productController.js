import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';

const PRODUCTS_CACHE_KEY = 'products';

export const getProducts = async (req, res, next) => {
  try {
    // Check Redis cache first
    const cachedProducts = await redisClient.get(PRODUCTS_CACHE_KEY);
    if (cachedProducts) return res.json(JSON.parse(cachedProducts));

    // Fetch from DB if not cached
    const products = await Product.find().lean();
    await redisClient.setEx(PRODUCTS_CACHE_KEY, 3600, JSON.stringify(products)); // Cache for 1h
    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const addProduct = async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    await redisClient.del(PRODUCTS_CACHE_KEY); // Invalidate cache
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// (Similarly, implement cartController.js, wishlistController.js, etc.)

