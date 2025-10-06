import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import domainRoutes from './routes/domain.routes';
import emailRoutes from './routes/email.routes';
import campaignRoutes from './routes/campaign.routes';
import analyticsRoutes from './routes/analytics.routes';
import monitoringRoutes from './routes/monitoring.routes';

// Load environment variables
dotenv.config();

const app: express.Application = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes); // Add this
app.use('/api/monitoring', monitoringRoutes);
// Add this route to the existing routes
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
