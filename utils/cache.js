
import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: 'jXRbhHcwUz9IwtNvP0JDiLYqM0wSLirc',
    socket: {
        host: 'redis-19035.crce179.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 19035
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar

// Function to clear all product-related cache keys
export const clearProductCache = async () => {
  try {
    // Get all keys that match various product-related patterns
    const patterns = ['products:*', 'product:*'];
    let allKeys = [];
    
    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      allKeys = allKeys.concat(keys);
    }
    
    if (allKeys.length > 0) {
      await client.del(allKeys);
      console.log(`Cleared ${allKeys.length} product cache keys`);
    }
  } catch (error) {
    console.error('Error clearing product cache:', error);
  }
};

// Function to clear all cart-related cache keys
export const clearCartCache = async () => {
  try {
    // Get all keys that match the pattern 'cart:*'
    const keys = await client.keys('cart:*');
    if (keys.length > 0) {
      await client.del(keys);
      console.log(`Cleared ${keys.length} cart cache keys`);
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
    if (keys.length > 0) {
      await client.del(keys);
      console.log(`Cleared ${keys.length} wishlist cache keys`);
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
