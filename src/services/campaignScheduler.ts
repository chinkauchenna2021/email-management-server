import cron from 'node-cron';
import { CampaignService } from './campaign.services';
import { logger } from '../utils/logger';
import {prisma} from '../config/database';

export class CampaignScheduler {
  private static instance: CampaignScheduler;
  private scheduledJobs: Map<string, any> = new Map();

  private constructor() {
    this.initializeScheduler();
  }

  public static getInstance(): CampaignScheduler {
    if (!CampaignScheduler.instance) {
      CampaignScheduler.instance = new CampaignScheduler();
    }
    return CampaignScheduler.instance;
  }

  private initializeScheduler(): void {
    // Check for scheduled campaigns every minute
    cron.schedule('* * * * *', async () => {
      try {
        await this.processScheduledCampaigns();
      } catch (error) {
        logger.error('Error processing scheduled campaigns:', error);
      }
    });

    logger.info('Campaign scheduler initialized');
  }

  private async processScheduledCampaigns(): Promise<void> {
    const now = new Date();
    
    try {
      // Find campaigns scheduled to run now or in the past that are still in SCHEDULED status
      const scheduledCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: now,
          },
        },
        include: {
          domain: true,
          list: {
            include: {
              emails: true,
            },
          },
          user: true,
        },
      });

      for (const campaign of scheduledCampaigns) {
        try {
          logger.info(`Processing scheduled campaign: ${campaign.name} (${campaign.id})`);
          
          // Update campaign status to SENDING
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'SENDING', sentAt: new Date() },
          });

          // Send the campaign
          await CampaignService.sendScheduledCampaign(campaign);
          
          logger.info(`Successfully sent scheduled campaign: ${campaign.name}`);
        } catch (error) {
          logger.error(`Failed to send scheduled campaign ${campaign.id}:`, error);
          
          // Mark campaign as failed
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'FAILED' },
          });
        }
      }
    } catch (error) {
      logger.error('Error in processScheduledCampaigns:', error);
    }
  }

  /**
   * Schedule a specific campaign for future sending
   */
  public async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Remove existing job if any
      this.unscheduleCampaign(campaignId);

      // Calculate cron expression for the specific date
      const cronExpression = this.dateToCron(scheduledAt);
      
      // Schedule the job
      const job = cron.schedule(cronExpression, async () => {
        try {
          await this.executeScheduledCampaign(campaignId);
        } catch (error) {
          logger.error(`Error executing scheduled campaign ${campaignId}:`, error);
        }
      });

      this.scheduledJobs.set(campaignId, job);
      logger.info(`Campaign ${campaignId} scheduled for ${scheduledAt}`);
    } catch (error) {
      logger.error(`Error scheduling campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Unschedule a campaign
   */
  public unscheduleCampaign(campaignId: string): void {
    const job = this.scheduledJobs.get(campaignId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(campaignId);
      logger.info(`Unscheduled campaign: ${campaignId}`);
    }
  }

  /**
   * Execute a scheduled campaign immediately
   */
  private async executeScheduledCampaign(campaignId: string): Promise<void> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          domain: true,
          list: {
            include: {
              emails: true,
            },
          },
          user: true,
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Update status and send
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'SENDING', sentAt: new Date() },
      });

      await CampaignService.sendScheduledCampaign(campaign);
      
      // Remove the job after execution
      this.unscheduleCampaign(campaignId);
      
      logger.info(`Successfully executed scheduled campaign: ${campaign.name}`);
    } catch (error) {
      logger.error(`Error executing scheduled campaign ${campaignId}:`, error);
      
      // Mark as failed
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED' },
      });
      
      throw error;
    }
  }

  /**
   * Convert Date to cron expression
   */
  private dateToCron(date: Date): string {
    const minutes = date.getMinutes();
    const hours = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // months are 0-indexed in JS
    const dayOfWeek = date.getDay();

    return `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
  }

  /**
   * Initialize and schedule all pending campaigns on server start
   */
  public async initializePendingCampaigns(): Promise<void> {
    try {
      const pendingCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            gt: new Date(), // Only future scheduled campaigns
          },
        },
      });

      for (const campaign of pendingCampaigns) {
        if (campaign.scheduledAt) {
          await this.scheduleCampaign(campaign.id, campaign.scheduledAt);
        }
      }

      logger.info(`Initialized ${pendingCampaigns.length} pending campaigns`);
    } catch (error) {
      logger.error('Error initializing pending campaigns:', error);
    }
  }

  /**
   * Get all scheduled jobs (for monitoring)
   */
  public getScheduledJobs(): Map<string, any> {
    return new Map(this.scheduledJobs);
  }
}