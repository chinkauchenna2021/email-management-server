import {prisma} from '../config/database';
import { logger } from '../utils/logger';

export class MonitoringService {
  /**
   * Get email metrics
   */
  static async getEmailMetrics(userId: string) {
    try {
      // Get all campaigns for the user
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
        include: {
          sends: true,
        },
      });

      // Calculate metrics
      const totalSent = campaigns.reduce((sum, campaign) => sum + campaign.sends.length, 0);
      const delivered = campaigns.reduce((sum, campaign) => 
        sum + campaign.sends.filter(send => send.status === 'DELIVERED').length, 0);
      const opened = campaigns.reduce((sum, campaign) => 
        sum + campaign.sends.filter(send => send.status === 'OPENED').length, 0);
      const clicked = campaigns.reduce((sum, campaign) => 
        sum + campaign.sends.filter(send => send.status === 'CLICKED').length, 0);
      const bounced = campaigns.reduce((sum, campaign) => 
        sum + campaign.sends.filter(send => send.status === 'BOUNCED').length, 0);
      const unsubscribed = campaigns.reduce((sum, campaign) => 
        sum + campaign.sends.filter(send => send.status === 'COMPLAINED').length, 0);

      const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
      const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
      const clickRate = delivered > 0 ? (clicked / delivered) * 100 : 0;
      const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;
      const unsubscribeRate = delivered > 0 ? (unsubscribed / delivered) * 100 : 0;

      return {
        totalSent,
        delivered,
        opened,
        clicked,
        bounced,
        unsubscribed,
        deliveryRate: parseFloat(deliveryRate.toFixed(1)),
        openRate: parseFloat(openRate.toFixed(1)),
        clickRate: parseFloat(clickRate.toFixed(1)),
        bounceRate: parseFloat(bounceRate.toFixed(1)),
        unsubscribeRate: parseFloat(unsubscribeRate.toFixed(1)),
      };
    } catch (error) {
      logger.error('Get email metrics error:', error);
      throw error;
    }
  }

  /**
   * Get email jobs
   */
  static async getEmailJobs(userId: string, filters: { status?: string; type?: string; search?: string }) {
    try {
      // This is a simplified implementation
      // In a real app, you would have a jobs table in the database
      const mockJobs = [
        {
          id: "1",
          name: "Newsletter Campaign #47",
          type: "campaign",
          status: "running",
          progress: 65,
          totalEmails: 15420,
          processed: 10023,
          successful: 9876,
          failed: 147,
          bounced: 234,
          opened: 4567,
          clicked: 1234,
          unsubscribed: 23,
          startedAt: "2024-03-20T10:30:00Z",
          estimatedCompletion: "2024-03-20T11:45:00Z",
          throughput: 125,
          errorRate: 1.5,
          settings: { throttle: 100, retries: 3 },
        },
        {
          id: "2",
          name: "Product Launch Validation",
          type: "validation",
          status: "completed",
          progress: 100,
          totalEmails: 8234,
          processed: 8234,
          successful: 8100,
          failed: 134,
          bounced: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          startedAt: "2024-03-20T09:15:00Z",
          completedAt: "2024-03-20T09:45:00Z",
          throughput: 275,
          errorRate: 1.6,
          settings: { timeout: 30, concurrent: 10 },
        },
        {
          id: "3",
          name: "Customer List Import",
          type: "import",
          status: "paused",
          progress: 45,
          totalEmails: 25000,
          processed: 11250,
          successful: 10980,
          failed: 270,
          bounced: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          startedAt: "2024-03-20T08:00:00Z",
          throughput: 200,
          errorRate: 2.4,
          settings: { batchSize: 500, validateOnImport: true },
        },
      ];

      // Apply filters
      let filteredJobs = mockJobs;
      
      if (filters.status && filters.status !== 'all') {
        filteredJobs = filteredJobs.filter(job => job.status === filters.status);
      }
      
      if (filters.type && filters.type !== 'all') {
        filteredJobs = filteredJobs.filter(job => job.type === filters.type);
      }
      
      if (filters.search) {
        filteredJobs = filteredJobs.filter(job => 
          job.name.toLowerCase().includes(filters.search!.toLowerCase())
        );
      }

      return filteredJobs;
    } catch (error) {
      logger.error('Get email jobs error:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  static async getJobById(userId: string, id: string) {
    try {
      // This is a simplified implementation
      // In a real app, you would fetch from a jobs table
      const mockJobs = [
        {
          id: "1",
          name: "Newsletter Campaign #47",
          type: "campaign",
          status: "running",
          progress: 65,
          totalEmails: 15420,
          processed: 10023,
          successful: 9876,
          failed: 147,
          bounced: 234,
          opened: 4567,
          clicked: 1234,
          unsubscribed: 23,
          startedAt: "2024-03-20T10:30:00Z",
          estimatedCompletion: "2024-03-20T11:45:00Z",
          throughput: 125,
          errorRate: 1.5,
          settings: { throttle: 100, retries: 3 },
        },
        {
          id: "2",
          name: "Product Launch Validation",
          type: "validation",
          status: "completed",
          progress: 100,
          totalEmails: 8234,
          processed: 8234,
          successful: 8100,
          failed: 134,
          bounced: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          startedAt: "2024-03-20T09:15:00Z",
          completedAt: "2024-03-20T09:45:00Z",
          throughput: 275,
          errorRate: 1.6,
          settings: { timeout: 30, concurrent: 10 },
        },
        {
          id: "3",
          name: "Customer List Import",
          type: "import",
          status: "paused",
          progress: 45,
          totalEmails: 25000,
          processed: 11250,
          successful: 10980,
          failed: 270,
          bounced: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          startedAt: "2024-03-20T08:00:00Z",
          throughput: 200,
          errorRate: 2.4,
          settings: { batchSize: 500, validateOnImport: true },
        },
      ];

      return mockJobs.find(job => job.id === id) || null;
    } catch (error) {
      logger.error('Get job by ID error:', error);
      throw error;
    }
  }
}