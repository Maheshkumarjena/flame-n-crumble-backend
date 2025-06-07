import dotenv from 'dotenv';
dotenv.config();

console.log('Environment Variables Loaded');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
export const env = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/flameandcrumble',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  NODE_ENV: process.env.NODE_ENV || 'development',
  REDIS_URL: process.env.REDIS_URL || 'redis-cli -u redis://default:jXRbhHcwUz9IwtNvP0JDiLYqM0wSLirc@redis-19035.crce179.ap-south-1-1.ec2.redns.redis-cloud.com:19035',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
};