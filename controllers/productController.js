import Product from '../models/Product.js';
import { redisClient } from '../utils/cache.js';
import mongoose from 'mongoose';

const PRODUCTS_CACHE_KEY = 'products';

// Existing controller
export const getProducts = async (req, res, next) => {
  try {
    const cachedProducts = await redisClient.get(PRODUCTS_CACHE_KEY);
    if (cachedProducts) return res.json(JSON.parse(cachedProducts));

    const products = await Product.find().lean();
    await redisClient.setEx(PRODUCTS_CACHE_KEY, 600, JSON.stringify(products));
    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const getBatchProducts = async (req, res, next) => {
  console.log('--- getBatchProducts function started ---');
  try {
    const { productIds } = req.body;
    console.log('Received productIds:', productIds);

    // Validate input
    if (!productIds || !Array.isArray(productIds)) {
      console.log('Validation failed: productIds is null, undefined, or not an array.');
      return res.status(400).json({
        error: 'Invalid request format. Please provide an array of product IDs.'
      });
    }
    console.log('Validation successful: productIds is an array.');

    // Validate each ID is a valid MongoDB ObjectId
    const invalidIds = productIds.filter(
      id => {
        const isValid = mongoose.Types.ObjectId.isValid(id._id);
        if (!isValid) {
          console.log(`Invalid ObjectId found: ${id}`);
        }
        return !isValid;
      }
    );

    if (invalidIds.length > 0) {
      console.log('Validation failed: Found invalid product IDs.', invalidIds);
      return res.status(400).json({
        error: 'Invalid product IDs',
        invalidIds,
        message: 'Some product IDs are not valid MongoDB ObjectIds'
      });
    }
    console.log('All product IDs are valid MongoDB ObjectIds.');

    // Create cache key based on sorted product IDs
    const sortedIds = [...productIds].sort();
    const batchCacheKey = `${PRODUCTS_CACHE_KEY}:batch:${sortedIds.join('-')}`;
    console.log('Generated batchCacheKey:', batchCacheKey);

    // Check Redis cache first
    const cachedBatch = await redisClient.get(batchCacheKey);
    console.log('Checked Redis cache. Cached batch:', cachedBatch ? 'found' : 'not found');
    if (cachedBatch) {
      console.log('Returning cached data.');
      return res.json(JSON.parse(cachedBatch));
    }

    // Fetch from DB if not cached
    console.log('Fetching products from database...');
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
    console.log('Products fetched from DB:', products.length, 'items.');

    // Create a map for quick lookup
    const productMap = {};
    products.forEach(product => {
      productMap[product._id.toString()] = product;
    });
    console.log('Created productMap:', Object.keys(productMap).length, 'entries.');


    // Format response to maintain order of requested IDs
    const response = productIds.map(id => {
      const product = productMap[id];
      if (!product) {
        console.log(`Product with ID ${id} not found in DB results.`);
        return {
          _id: id,
          error: 'Product not found',
          exists: false
        };
      }
      return product;
    });
    console.log('Formatted response array. Length:', response.length);

    // Cache the results for 30 minutes (1800 seconds)
    await redisClient.setEx(batchCacheKey, 1800, JSON.stringify(response));
    console.log('Cached results in Redis for', batchCacheKey);

    res.json(response);
    console.log('--- getBatchProducts function finished successfully ---');
  } catch (err) {
    console.error('Error in getBatchProducts:', err);
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