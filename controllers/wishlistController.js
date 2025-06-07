import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';

const WISHLIST_CACHE_PREFIX = 'wishlist:';

export const getWishlist = async (req, res, next) => {
  try {
    const cacheKey = `${WISHLIST_CACHE_PREFIX}${req.userId}`;
    const cachedWishlist = await redisClient.get(cacheKey);
    
    if (cachedWishlist) {
      return res.json(JSON.parse(cachedWishlist));
    }

    const wishlist = await Wishlist.findOne({ user: req.userId }).populate('items.product');
    if (!wishlist) {
      return res.json({ items: [] });
    }

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(wishlist)); // Cache for 1h
    res.json(wishlist);
  } catch (err) {
    next(err);
  }
};

export const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let wishlist = await Wishlist.findOne({ user: req.userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.userId, items: [] });
    }

    // Check if already in wishlist
    const exists = wishlist.items.some(item => 
      item.product.toString() === productId
    );

    if (exists) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    wishlist.items.push({ product: productId });
    await wishlist.save();
    await redisClient.del(`${WISHLIST_CACHE_PREFIX}${req.userId}`);
    res.status(201).json(wishlist);
  } catch (err) {
    next(err);
  }
};