import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';

const CART_CACHE_PREFIX = 'cart:';

export const getCart = async (req, res, next) => {
  try {
    const cacheKey = `${CART_CACHE_PREFIX}${req.userId}`;
    const cachedCart = await redisClient.get(cacheKey);
    
    if (cachedCart) {
      return res.json(JSON.parse(cachedCart));
    }

    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');
    if (!cart) {
      return res.json({ items: [] });
    }

    await redisClient.setEx(cacheKey, 1800, JSON.stringify(cart)); // Cache for 30 mins
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await Cart.findOne({ user: req.userId });
    
    if (!cart) {
      cart = new Cart({ user: req.userId, items: [] });
    }

    const existingItem = cart.items.find(item => 
      item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    await redisClient.del(`${CART_CACHE_PREFIX}${req.userId}`); // Invalidate cache
    res.status(201).json(cart);
  } catch (err) {
    next(err);
  }
};

// Similarly implement updateCartItem and removeFromCart