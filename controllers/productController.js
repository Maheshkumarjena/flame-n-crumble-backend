import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';
import mongoose from 'mongoose';

const PRODUCTS_CACHE_KEY = 'products';

// Existing controller

const PRODUCTS_CACHE_TTL = 600; // 10 minutes

export const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 9,
      category,
      inStock,
      isFeatured,
      sortBy = 'default',
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build MongoDB query
    const query = {};
    if (category) query.category = category.toLowerCase();
    if (inStock === 'true') query.stock = { $gt: 0 };
    if (isFeatured === 'true') query.isFeatured = true;

    // Build sorting logic
    const sortOptions = (() => {
      switch (sortBy) {
        case 'price-asc':
          return { price: 1 };
        case 'price-desc':
          return { price: -1 };
        case 'newest':
          return { createdAt: -1 };
        default:
          return { name: 1 }; // alphabetical
      }
    })();

    // Generate a dynamic cache key based on filters
    const cacheKey = `products:${pageNum}:${limitNum}:${category || 'all'}:${inStock}:${isFeatured}:${sortBy}`;

    // Try to get from cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // DB query
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query),
    ]);

    const response = {
      products,
      total,
    };

    await redisClient.setEx(cacheKey, PRODUCTS_CACHE_TTL, JSON.stringify(response));
    res.json(response);
  } catch (err) {
    next(err);
  }
};


export const getBatchProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    // Validate input
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        error: 'Invalid request format. Please provide an array of product IDs.'
      });
    }

    // Validate each ID is a valid MongoDB ObjectId
    const invalidIds = productIds.filter(
      id => {
        const isValid = mongoose.Types.ObjectId.isValid(id._id);
        return !isValid;
      }
    );

    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Invalid product IDs',
        invalidIds,
        message: 'Some product IDs are not valid MongoDB ObjectIds'
      });
    }

    // Create cache key based on sorted product IDs
    const sortedIds = [...productIds].sort();
    const batchCacheKey = `${PRODUCTS_CACHE_KEY}:batch:${sortedIds.join('-')}`;

    // Check Redis cache first
    const cachedBatch = await redisClient.get(batchCacheKey);
    if (cachedBatch) {
      return res.json(JSON.parse(cachedBatch));
    }

    // Fetch from DB if not cached
    const products = await Product.find(
      { _id: { $in: productIds } },
      {
        name: 1,
        price: 1,
        category: 1,
        stock: 1,
        image: 1,
        isFeatured: 1,
        _id: 1
      }
    ).lean();

    // Create a map for quick lookup
    const productMap = {};
    products.forEach(product => {
      productMap[product._id.toString()] = product;
    });


    // Format response to maintain order of requested IDs
    const response = productIds.map(id => {
      const product = productMap[id];
      if (!product) {
        return {
          _id: id,
          error: 'Product not found',
          exists: false
        };
      }
      return product;
    });

    // Cache the results for 30 minutes (1800 seconds)
    await redisClient.setEx(batchCacheKey, 1800, JSON.stringify(response));

    res.json(response);
  } catch (err) {
    next(err);
  }
};


// Additional helper function that might be useful
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const cacheKey = `${PRODUCTS_CACHE_KEY}:${id}`;
    const cachedProduct = await redisClient.get(cacheKey);
    
    if (cachedProduct) {
      return res.json(JSON.parse(cachedProduct));
    }

    const product = await Product.findById(id).lean();
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await redisClient.setEx(cacheKey, 600, JSON.stringify(product));
    res.json(product);
  } catch (err) {
    next(err);
  }
};