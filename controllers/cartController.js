import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';

const CART_CACHE_PREFIX = 'cart:';

/**
 * @desc Get user's cart
 * @route GET /api/cart
 * @access Private
 */
export const getCart = async (req, res, next) => {
  try {
    const cacheKey = `${CART_CACHE_PREFIX}${req.userId}`;
    const cachedCart = await redisClient.get(cacheKey);
    
    // If cart is found in cache, return it
    if (cachedCart) {
      return res.json(JSON.parse(cachedCart));
    }

    // Find the cart for the authenticated user and populate product details
    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');
    
    // If no cart exists for the user, return an empty items array
    if (!cart) {
      return res.json({ items: [] });
    }

    // Cache the cart data for 30 minutes (1800 seconds)
    await redisClient.setEx(cacheKey, 1800, JSON.stringify(cart)); 
    res.json(cart);
  } catch (err) {
    // Pass any errors to the global error handler
    next(err);
  }
};

/**
 * @desc Add product to cart
 * @route POST /api/cart
 * @access Private
 */
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    // Validate that the product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await Cart.findOne({ user: req.userId });
    
    // If no cart exists for the user, create a new one
    if (!cart) {
      cart = new Cart({ user: req.userId, items: [] });
    }

    // Check if the product already exists in the cart
    const existingItem = cart.items.find(item => 
      item.product.toString() === productId
    );

    // If item exists, update its quantity
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      // If item does not exist, add it to the cart
      cart.items.push({ product: productId, quantity });
    }

    // Save the updated cart to the database
    await cart.save();
    // Invalidate the user's cart cache to ensure fresh data on next fetch
    await redisClient.del(`${CART_CACHE_PREFIX}${req.userId}`); 
    res.status(201).json(cart);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update quantity of an item in the cart
 * @route PATCH /api/cart/:itemId
 * @access Private
 */
export const updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params; // The ID of the item in the `items` array, not the product ID
    const { quantity } = req.body;

    // Validate quantity
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    let cart = await Cart.findOne({ user: req.userId });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Find the specific item in the cart's items array
    const itemToUpdate = cart.items.id(itemId); // Mongoose's .id() method for subdocuments

    if (!itemToUpdate) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    itemToUpdate.quantity = quantity; // Update the quantity
    
    await cart.save(); // Save the updated cart
    // Invalidate cache after update
    await redisClient.del(`${CART_CACHE_PREFIX}${req.userId}`);
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Remove item from cart
 * @route DELETE /api/cart/:itemId
 * @access Private
 */
export const removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params; // The ID of the item in the `items` array

    let cart = await Cart.findOne({ user: req.userId });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Use Mongoose's pull method to remove the subdocument by its _id
    cart.items.pull({ _id: itemId }); 
    
    await cart.save(); // Save the updated cart
    // Invalidate cache after removal
    await redisClient.del(`${CART_CACHE_PREFIX}${req.userId}`);
    res.json({ message: 'Item removed from cart', cart });
  } catch (err) {
    next(err);
  }
};
