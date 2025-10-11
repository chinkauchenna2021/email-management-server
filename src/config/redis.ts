import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    timeout: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.log('Too many retries on REDIS. Connection terminated');
        return new Error('Too many retries');
      }
      return Math.min(retries * 100, 3000);
    },
    // For Render's Redis
    tls: process.env.NODE_ENV === 'production' ? true : undefined,
  },
});

// Event handlers
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis ready');
});

redisClient.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

redisClient.on('end', () => {
  console.log('Redis connection closed');
});


export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Redis connection failed:', error);
    process.exit(1);
  }
};

// Connect to Redis
export const disconnectRedis = async () => {
  await redisClient.disconnect();
  logger.info('Redis disconnected');
};

export default redisClient;


