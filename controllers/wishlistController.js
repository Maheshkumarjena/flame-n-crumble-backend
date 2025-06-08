import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';

const WISHLIST_CACHE_PREFIX = 'wishlist:';

/**
 * @desc Get user's wishlist
 * @route GET /api/wishlist
 * @access Private
 */
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

/**
 * @desc Add product to wishlist
 * @route POST /api/wishlist
 * @access Private
 */
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

/**
 * @desc Remove product from wishlist
 * @route DELETE /api/wishlist/:productId
 * @access Private
 */
export const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params; // The ID of the product to remove

    let wishlist = await Wishlist.findOne({ user: req.userId });

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    // Use Mongoose's pull method to remove the subdocument by its product _id
    // We need to find the item in the array that matches the productId
    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(item => item.product.toString() !== productId);

    if (wishlist.items.length === initialLength) {
      // If the length didn't change, it means the product was not found in the wishlist
      return res.status(404).json({ error: 'Product not found in wishlist' });
    }
    
    await wishlist.save(); // Save the updated wishlist
    // Invalidate cache after removal
    await redisClient.del(`${WISHLIST_CACHE_PREFIX}${req.userId}`);
    res.json({ message: 'Product removed from wishlist', wishlist });
  } catch (err) {
    next(err);
  }
};
