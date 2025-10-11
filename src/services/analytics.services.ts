import {prisma} from '../config/database';
import { logger } from '../utils/logger';

export class AnalyticsService {
  /**
   * Get overall email metrics
   */
  static async getOverallMetrics(userId: string) {
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
      logger.error('Get overall metrics error:', error);
      throw error;
    }
  }

  /**
   * Get performance data over time
   */
  static async getPerformanceData(userId: string, timeRange: string) {
    try {
      // This is a simplified implementation
      // In a real app, you would aggregate data by month based on the timeRange
      const performanceData = [
        { month: "Jan", sent: 45000, delivered: 43200, opened: 12960, clicked: 2592, bounced: 1800, unsubscribed: 180 },
        { month: "Feb", sent: 52000, delivered: 50440, opened: 15132, clicked: 3022, bounced: 1560, unsubscribed: 208 },
        { month: "Mar", sent: 48000, delivered: 46560, opened: 13968, clicked: 2794, bounced: 1440, unsubscribed: 192 },
        { month: "Apr", sent: 61000, delivered: 59170, opened: 17751, clicked: 3550, bounced: 1830, unsubscribed: 244 },
        { month: "May", sent: 55000, delivered: 53350, opened: 16005, clicked: 3201, bounced: 1650, unsubscribed: 220 },
        { month: "Jun", sent: 67000, delivered: 65030, opened: 19509, clicked: 3902, bounced: 1970, unsubscribed: 268 },
      ];

      return performanceData;
    } catch (error) {
      logger.error('Get performance data error:', error);
      throw error;
    }
  }

  /**
   * Get device breakdown data
   */
  static async getDeviceBreakdown(userId: string) {
    try {
      // This is a simplified implementation
      // In a real app, you would track device types from email opens
      const deviceData = [
        { name: "Desktop", value: 45 },
        { name: "Mobile", value: 38 },
        { name: "Tablet", value: 17 },
      ];

      return deviceData;
    } catch (error) {
      logger.error('Get device breakdown error:', error);
      throw error;
    }
  }

  /**
   * Get optimal timing data
   */
  static async getOptimalTiming(userId: string) {
    try {
      // This is a simplified implementation
      // In a real app, you would analyze open times by hour
      const timeData = [
        { hour: "6 AM", opens: 120, clicks: 24 },
        { hour: "8 AM", opens: 340, clicks: 68 },
        { hour: "10 AM", opens: 580, clicks: 116 },
        { hour: "12 PM", opens: 720, clicks: 144 },
        { hour: "2 PM", opens: 650, clicks: 130 },
        { hour: "4 PM", opens: 480, clicks: 96 },
        { hour: "6 PM", opens: 380, clicks: 76 },
        { hour: "8 PM", opens: 290, clicks: 58 },
      ];

      return timeData;
    } catch (error) {
      logger.error('Get optimal timing error:', error);
      throw error;
    }
  }

  /**
   * Get domain reputation data
   */
  static async getDomainReputation(userId: string) {
    try {
      const domains = await prisma.domain.findMany({
        where: { userId },
      });

      const domainReputation = domains.map(domain => ({
        domain: domain.domain,
        reputation: domain.reputation,
        emails: 0, // This would be calculated from actual sends
        deliverability: domain.reputation, // Simplified for demo
      }));

      return domainReputation;
    } catch (error) {
      logger.error('Get domain reputation error:', error);
      throw error;
    }
  }

  /**
   * Get campaign performance data
   */
  static async getCampaignPerformance(userId: string) {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
        include: {
          sends: true,
        },
      });

      const campaignPerformance = campaigns.map(campaign => {
        const sent = campaign.sends.length;
        const opened = campaign.sends.filter(send => send.status === 'OPENED').length;
        const clicked = campaign.sends.filter(send => send.status === 'CLICKED').length;
        
        return {
          name: campaign.name,
          sent,
          opened,
          clicked,
          openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(1)) : 0,
          clickRate: sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(1)) : 0,
          revenue: 0, // This would be calculated from actual conversions
        };
      });

      return campaignPerformance;
    } catch (error) {
      logger.error('Get campaign performance error:', error);
      throw error;
    }
  }
}