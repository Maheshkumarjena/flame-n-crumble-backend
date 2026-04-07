
import { createClient } from 'redis';
import { env } from '../config/env.js';

const client = createClient({
    url: env.REDIS_URL
});

client.on('error', err => console.log('Redis Client Error', err));

// Retry logic with exponential backoff
const connectRedis = async (attempt = 1, maxAttempts = 5) => {
  try {
    await client.connect();
    console.log('Redis connected successfully');
  } catch (err) {
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff up to 10s
      console.log(`Redis connection failed. Retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      setTimeout(() => connectRedis(attempt + 1, maxAttempts), delay);
    } else {
      console.error('Redis connection failed after max attempts:', err);
    }
  }
};

await connectRedis();

// Optimized function to scan and clear keys using SCAN instead of KEYS
const scanAndDeleteKeys = async (pattern) => {
  try {
    const keys = [];
    let cursor = '0';
    
    do {
      const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys.length > 0) {
        keys.push(...reply.keys);
      }
    } while (cursor !== '0');
    
    if (keys.length > 0) {
      // Delete in batches to avoid command buffer overflow
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await client.del(batch);
      }
      return keys.length;
    }
    return 0;
  } catch (error) {
    console.error(`Error scanning/deleting keys for pattern ${pattern}:`, error);
    return 0;
  }
};

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar

// Function to clear all product-related cache keys
export const clearProductCache = async () => {
  try {
    const patterns = ['products:*', 'product:*'];
    let totalCleared = 0;
    
    for (const pattern of patterns) {
      const cleared = await scanAndDeleteKeys(pattern);
      totalCleared += cleared;
    }
    
    if (totalCleared > 0) {
      console.log(`Cleared ${totalCleared} product cache keys`);
    }
  } catch (error) {
    console.error('Error clearing product cache:', error);
  }
};

// Function to clear all cart-related cache keys
export const clearCartCache = async () => {
  try {
    const cleared = await scanAndDeleteKeys('cart:*');
    if (cleared > 0) {
      console.log(`Cleared ${cleared} cart cache keys`);
    }
  } catch (error) {
    console.error('Error clearing cart cache:', error);
  }
};

// Function to clear all wishlist-related cache keys
export const clearWishlistCache = async () => {
  try {
    // Get all keys that match the pattern 'wishlist:*'
    const keys = await client.keys('wishlist:*');
    const cleared = await scanAndDeleteKeys('wishlist:*');
    if (cleared > 0) {
      console.log(`Cleared ${cleared} wishlist entries.`);
    }
  } catch (error) {
    console.error('Error clearing wishlist cache:', error);
  }
};

// Function to clear all related caches when products are modified
export const clearAllProductRelatedCache = async () => {
  try {
    await Promise.all([
      clearProductCache(),
      clearCartCache(),
      clearWishlistCache()
    ]);
    console.log('Successfully cleared all product-related cache keys');
  } catch (error) {
    console.error('Error clearing all product-related cache:', error);
  }
};

export { client as redisClient };
