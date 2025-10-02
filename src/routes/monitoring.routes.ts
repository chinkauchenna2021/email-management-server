// src/routes/monitoring.ts
import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoring.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Monitoring routes
router.get('/metrics', MonitoringController.getMetrics);
router.get('/jobs', MonitoringController.getJobs);
router.get('/jobs/:id', MonitoringController.getJobById);

export default router;