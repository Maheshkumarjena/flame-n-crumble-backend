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



