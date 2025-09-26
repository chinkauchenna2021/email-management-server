import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Queue } from 'bullmq';
import redisClient from '../config/redis';

// Create email queue
export const emailQueue = new Queue('emailQueue', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    // Add other options as needed
  },
});

export class CampaignService {
  /**
   * Create a new campaign
   */
  static async createCampaign(
    userId: string,
    name: string,
    subject: string,
    content: string,
    domainId: string,
    listId: string,
    scheduledAt?: Date
  ) {
    try {
      // Check if domain exists and belongs to user
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId },
      });
      
      if (!domain) {
        throw new Error('Domain not found');
      }
      
      // Check if domain is verified
      if (!domain.verified) {
        throw new Error('Domain is not verified');
      }
      
      // Check if email list exists and belongs to user
      const emailList = await prisma.emailList.findFirst({
        where: { id: listId, userId },
      });
      
      if (!emailList) {
        throw new Error('Email list not found');
      }
      
      // Create campaign
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          name,
          subject,
          content,
          domainId,
          listId,
          scheduledAt,
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        },
      });
      
      return campaign;
    } catch (error) {
      logger.error('Create campaign error:', error);
      throw error;
    }
  }
  
  /**
   * Get user campaigns
   */
  static async getUserCampaigns(userId: string, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const [campaigns, totalCount] = await Promise.all([
        prisma.campaign.findMany({
          where: { userId },
          include: {
            domain: true,
            list: true,
            _count: {
              select: { sends: true },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.campaign.count({
          where: { userId },
        }),
      ]);
      
      return {
        campaigns,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get user campaigns error:', error);
      throw error;
    }
  }
  
  /**
   * Get campaign details
   */
  static async getCampaignDetails(userId: string, campaignId: string) {
    try {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
        include: {
          domain: true,
          list: true,
          sends: {
            include: {
              email: true,
            },
          },
        },
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      return campaign;
    } catch (error) {
      logger.error('Get campaign details error:', error);
      throw error;
    }
  }
  
  /**
   * Send a campaign
   */
  static async sendCampaign(userId: string, campaignId: string) {
    try {
      // Get campaign
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
        include: {
          domain: true,
          list: {
            include: {
              emails: true,
            },
          },
        },
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Check if domain is verified
      if (!campaign.domain.verified) {
        throw new Error('Domain is not verified');
      }
      
      // Update campaign status
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'SENDING',
          sentAt: new Date(),
        },
      });
      
      // Create email send records for each email
      const emailSends = await prisma.emailSend.createMany({
        data: campaign.list.emails.map((email: { id: any; }) => ({
          emailId: email.id,
          campaignId: campaign.id,
        })),
      });
      
      // Add email sending jobs to queue
      for (const email of campaign.list.emails) {
        await emailQueue.add('sendEmail', {
          campaignId: campaign.id,
          emailId: email.id,
          domainId: campaign.domain.id,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      }
      
      return { message: 'Campaign sending started' };
    } catch (error) {
      logger.error('Send campaign error:', error);
      throw error;
    }
  }
  
  /**
   * Get campaign statistics
   */
  static async getCampaignStats(userId: string, campaignId: string) {
    try {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      const stats = await prisma.emailSend.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: {
          status: true,
        },
      });
      
      const statusCounts = stats.reduce((acc: { [x: string]: any; }, stat: { status: string | number; _count: { status: any; }; }) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        campaignId,
        status: campaign.status,
        stats: {
          total: Object.values(statusCounts).reduce((sum, count) => (Number(sum) + Number(count)), 0),
          pending: statusCounts.PENDING || 0,
          sent: statusCounts.SENT || 0,
          delivered: statusCounts.DELIVERED || 0,
          opened: statusCounts.OPENED || 0,
          clicked: statusCounts.CLICKED || 0,
          bounced: statusCounts.BOUNCED || 0,
          failed: statusCounts.FAILED || 0,
        },
      };
    } catch (error) {
      logger.error('Get campaign stats error:', error);
      throw error;
    }
  }
  
  /**
   * Retry failed emails in a campaign
   */
  static async retryFailedEmails(userId: string, campaignId: string) {
    try {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Get failed email sends
      const failedSends = await prisma.emailSend.findMany({
        where: {
          campaignId,
          status: { in: ['FAILED', 'BOUNCED'] },
        },
      });
      
      if (failedSends.length === 0) {
        return { message: 'No failed emails to retry' };
      }
      
      // Update status to RETRYING
      await prisma.emailSend.updateMany({
        where: {
          id: { in: failedSends.map((send: { id: any; }) => send.id) },
        },
        data: {
          status: 'RETRYING',
          retries: { increment: 1 },
        },
      });
      
      // Add retry jobs to queue
      for (const send of failedSends) {
        await emailQueue.add('sendEmail', {
          campaignId,
          emailId: send.emailId,
          domainId: campaign.domainId,
          isRetry: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      }
      
      return { 
        message: `Retrying ${failedSends.length} failed emails`,
        retryCount: failedSends.length,
      };
    } catch (error) {
      logger.error('Retry failed emails error:', error);
      throw error;
    }
  }
}