// src/routes/analytics.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Analytics routes
router.get('/metrics', AnalyticsController.getMetrics);
router.get('/performance', AnalyticsController.getPerformance);
router.get('/devices', AnalyticsController.getDevices);
router.get('/timing', AnalyticsController.getTiming);
router.get('/domains', AnalyticsController.getDomains);
router.get('/campaigns', AnalyticsController.getCampaigns);

export default router;