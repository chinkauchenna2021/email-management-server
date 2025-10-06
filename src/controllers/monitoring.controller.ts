import { Request, Response } from 'express';
import { MonitoringService } from '../services/monitoring.services';
import { logger } from '../utils/logger';

export class MonitoringController {
  /**
   * Get email metrics
   */
  static async getMetrics(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const metrics = await MonitoringService.getEmailMetrics(userId);
      res.json(metrics);
    } catch (error) {
      logger.error('Get monitoring metrics error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get email jobs
   */
  static async getJobs(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { status, type, search } = req.query;
      const jobs = await MonitoringService.getEmailJobs(userId, {
        status: status as string,
        type: type as string,
        search: search as string,
      });
      res.json(jobs);
    } catch (error) {
      logger.error('Get email jobs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get job by ID
   */
  static async getJobById(req: Request, res: Response):Promise<void | any> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const job = await MonitoringService.getJobById(userId, id);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      
      res.json(job);
    } catch (error) {
      logger.error('Get job by ID error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}