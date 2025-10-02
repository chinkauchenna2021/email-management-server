import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.services';
import { logger } from '../utils/logger';

export class AnalyticsController {
  /**
   * Get overall email metrics
   */
  static async getMetrics(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const metrics = await AnalyticsService.getOverallMetrics(userId);
      res.json(metrics);
    } catch (error) {
      logger.error('Get analytics metrics error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get performance data over time
   */
  static async getPerformance(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const timeRange = req.query.timeRange as string || '6months';
      const performance = await AnalyticsService.getPerformanceData(userId, timeRange);
      res.json(performance);
    } catch (error) {
      logger.error('Get performance data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get device breakdown data
   */
  static async getDevices(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const devices = await AnalyticsService.getDeviceBreakdown(userId);
      res.json(devices);
    } catch (error) {
      logger.error('Get device data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get optimal timing data
   */
  static async getTiming(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const timing = await AnalyticsService.getOptimalTiming(userId);
      res.json(timing);
    } catch (error) {
      logger.error('Get timing data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get domain reputation data
   */
  static async getDomains(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const domains = await AnalyticsService.getDomainReputation(userId);
      res.json(domains);
    } catch (error) {
      logger.error('Get domain data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Get campaign performance data
   */
  static async getCampaigns(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const campaigns = await AnalyticsService.getCampaignPerformance(userId);
      res.json(campaigns);
    } catch (error) {
      logger.error('Get campaign data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}