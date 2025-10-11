import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
// import { connectDB, disconnectDB } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { CampaignScheduler } from './services/campaignScheduler';

// Import routes
import authRoutes from './routes/auth.routes';
import domainRoutes from './routes/domain.routes';
import emailRoutes from './routes/email.routes';
import campaignRoutes from './routes/campaign.routes';
import templateRoutes from './routes/templates.routes';
import automationRoutes from './routes/automation.routes';
import settingsRoutes from './routes/settings.routes';
import analyticsRoutes from './routes/analytics.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handling
app.use(errorHandler);



// Initialize campaign scheduler
const campaignScheduler = CampaignScheduler.getInstance();

// Initialize pending campaigns on server start
campaignScheduler.initializePendingCampaigns().catch(error => {
  logger.error('Failed to initialize pending campaigns:', error);
});
// Start server
const startServer = async () => {
  try {
    // Connect to database
    // await connectDB();
    logger.info('Database connected successfully');
    
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');
    
    // Start server

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  try {
    // await disconnectDB();
    await disconnectRedis();
    logger.info('Database and Redis connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
