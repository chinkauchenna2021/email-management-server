import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisClient:any = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err: any) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Redis connection failed:', error);
    process.exit(1);
  }
};

export const disconnectRedis = async () => {
  await redisClient.disconnect();
  logger.info('Redis disconnected');
};

export default redisClient;