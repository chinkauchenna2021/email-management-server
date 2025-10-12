// services/databaseMonitor.services.ts
import cron from 'node-cron';
import { prisma } from '../config/database';
import { emailQueue } from './campaign.services';
import { logger } from '../utils/logger';

class DatabaseMonitorService {
  private isRunning = false;

  startMonitoring() {
    // Schedule to run every minute
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        logger.info('Database monitor is already running, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        await this.checkReadyCampaigns();
        await this.checkScheduledCampaigns();
        await this.checkFailedEmailsForRetry();
      } catch (error) {
        logger.error('Error in database monitoring:', error);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Database monitoring service started');
  }

  private async checkReadyCampaigns() {
    try {
      // Find campaigns that are READY (manual trigger)
      const readyCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'READY',
          scheduledAt: {
            lte: new Date() // Only campaigns that should have started
          }
        },
        include: {
          domain: true,
          list: {
            include: {
              emails: true
            }
          }
        }
      });

      for (const campaign of readyCampaigns) {
        logger.info(`Processing READY campaign: ${campaign.id} - ${campaign.name}`);

        // Update campaign status to SENDING
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'SENDING' }
        });

        // Create email send records and add to queue
        await this.processCampaignEmails(campaign);

        logger.info(`Campaign ${campaign.id} processing started with ${campaign.list.emails.length} emails`);
      }
    } catch (error) {
      logger.error('Error checking ready campaigns:', error);
      throw error;
    }
  }

  private async checkScheduledCampaigns() {
    try {
      // Find campaigns that are SCHEDULED
      const scheduledCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: new Date() // Campaigns that are due to be sent
          }
        },
        include: {
          domain: true,
          list: {
            include: {
              emails: true
            }
          }
        }
      });

      for (const campaign of scheduledCampaigns) {
        logger.info(`Processing SCHEDULED campaign: ${campaign.id} - ${campaign.name}`);

        // Update campaign status to SENDING
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { 
            status: 'SENDING',
            sentAt: new Date()
          }
        });

        // Create email send records and add to queue
        await this.processCampaignEmails(campaign);

        logger.info(`Scheduled campaign ${campaign.id} processing started`);
      }
    } catch (error) {
      logger.error('Error checking scheduled campaigns:', error);
      throw error;
    }
  }

  private async processCampaignEmails(campaign: any) {
    // Create email send records for each email in the list
    for (const email of campaign.list.emails) {
      // Check if email send record already exists
      const existingSend = await prisma.emailSend.findFirst({
        where: {
          emailId: email.id,
          campaignId: campaign.id
        }
      });

      if (existingSend) {
        // Update existing record
        await prisma.emailSend.update({
          where: { id: existingSend.id },
          data: {
            status: 'PENDING',
            bounceReason: null,
            openedAt: null,
            clickedAt: null,
            bouncedAt: null,
            complainedAt: null
          }
        });
      } else {
        // Create new record
        await prisma.emailSend.create({
          data: {
            emailId: email.id,
            campaignId: campaign.id,
            status: 'PENDING'
          }
        });
      }

      // Add email to queue
      await this.addEmailToQueue(
        campaign.id,
        email.id,
        campaign.domainId,
        false // isRetry
      );
    }

    // Create bulk email job record
    await prisma.bulkEmailJob.create({
      data: {
        campaignId: campaign.id,
        userId: campaign.userId,
        provider: campaign.domain.smtpProvider || 'nodemailer',
        status: 'processing',
        totalEmails: campaign.list.emails.length,
        processedEmails: 0,
        successCount: 0,
        failureCount: 0,
        startedAt: new Date()
      }
    });
  }

  private async checkFailedEmailsForRetry() {
    try {
      // Find failed emails that can be retried (less than 3 retries)
      const failedEmails = await prisma.emailSend.findMany({
        where: {
          status: 'FAILED',
          retries: {
            lt: 3 // Maximum 3 retry attempts
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Only from last 24 hours
          }
        },
        include: {
          campaign: {
            include: {
              domain: true
            }
          },
          email: true
        }
      });

      for (const emailSend of failedEmails) {
        // Check if enough time has passed since last attempt (exponential backoff)
        const lastAttempt = emailSend.updatedAt;
        const retryDelay = Math.pow(2, emailSend.retries) * 15 * 60 * 1000; // 15min, 30min, 60min
        
        if (Date.now() - lastAttempt.getTime() >= retryDelay) {
          await this.addEmailToQueue(
            emailSend.campaignId,
            emailSend.emailId,
            emailSend.campaign.domainId,
            true // isRetry
          );

          // Update status to RETRYING
          await prisma.emailSend.update({
            where: { id: emailSend.id },
            data: {
              status: 'RETRYING',
              retries: { increment: 1 }
            }
          });

          logger.info(`Scheduled retry for failed email: ${emailSend.email.address}, attempt: ${emailSend.retries + 1}`);
        }
      }
    } catch (error) {
      logger.error('Error checking failed emails for retry:', error);
      throw error;
    }
  }

  private async addEmailToQueue(
    campaignId: string,
    emailId: string,
    domainId: string,
    isRetry: boolean
  ) {
    const jobData = {
      campaignId,
      emailId,
      domainId,
      isRetry,
      timestamp: new Date().toISOString()
    };

    // Add job to queue with delay for retries
    const delay = isRetry ? Math.pow(2, (await this.getRetryCount(campaignId, emailId))) * 15 * 60 * 1000 : 0;

    await emailQueue.add('sendEmail', jobData, {
      jobId: `${campaignId}_${emailId}_${isRetry ? 'retry' : 'initial'}_${Date.now()}`,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000 // 1 minute
      },
      removeOnComplete: 100, // Keep only last 100 completed jobs
      removeOnFail: 50 // Keep only last 50 failed jobs
    });

    logger.debug(`Added email to queue: ${emailId} for campaign: ${campaignId}, retry: ${isRetry}`);
  }

  private async getRetryCount(campaignId: string, emailId: string): Promise<number> {
    const emailSend = await prisma.emailSend.findFirst({
      where: {
        campaignId,
        emailId
      }
    });

    return emailSend?.retries || 0;
  }

  // Manual campaign trigger
  async manuallyTriggerCampaign(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        domain: true,
        list: {
          include: {
            emails: true
          }
        }
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'DRAFT' && campaign.status !== 'READY') {
      throw new Error(`Campaign cannot be triggered from status: ${campaign.status}`);
    }

    // Update campaign to READY status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { 
        status: 'READY',
        scheduledAt: new Date()
      }
    });

    logger.info(`Manually triggered campaign: ${campaignId}`);
    return { success: true, message: 'Campaign queued for processing' };
  }

  // Schedule campaign for future
  async scheduleCampaign(campaignId: string, scheduleDate: Date) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'DRAFT') {
      throw new Error(`Campaign cannot be scheduled from status: ${campaign.status}`);
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { 
        status: 'SCHEDULED',
        scheduledAt: scheduleDate
      }
    });

    logger.info(`Scheduled campaign: ${campaignId} for ${scheduleDate}`);
    return { success: true, message: 'Campaign scheduled successfully' };
  }

  // Get monitoring statistics
  async getMonitoringStats() {
    const [
      pendingCampaigns,
      activeCampaigns,
      totalEmailsToday,
      failedEmails
    ] = await Promise.all([
      prisma.campaign.count({
        where: { status: { in: ['READY', 'SCHEDULED'] } }
      }),
      prisma.campaign.count({
        where: { status: 'SENDING' }
      }),
      prisma.emailSend.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.emailSend.count({
        where: { 
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const queueStats = await this.getQueueStats();

    return {
      pendingCampaigns,
      activeCampaigns,
      totalEmailsToday,
      failedEmails,
      queueStats
    };
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      emailQueue.getWaiting(),
      emailQueue.getActive(),
      emailQueue.getCompleted(),
      emailQueue.getFailed(),
      emailQueue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  }

  // Method to check domain warmup status and apply limits
  async checkDomainWarmupStatus(domainId: string) {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        campaigns: {
          where: {
            status: 'SENT',
            sentAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          include:{
            list:{
                include:{
                    emails:true
                }
            }
          }
        }
      }
    });

    if (!domain) {
      throw new Error('Domain not found');
    }
     
    const sentLast30Days = domain.campaigns.reduce((total, campaign) => {
      return total + (campaign.list?.emails?.length || 0);
    }, 0);

    const warmupStatus = {
      domain: domain.domain,
      enableDomainWarmup: domain.enableDomainWarmup,
      sentLast30Days,
      dailyLimit: domain.dailyLimit || 100,
      reputation: domain.reputation,
      isInWarmup: domain.enableDomainWarmup && sentLast30Days < 1000 // Example threshold
    };

    return warmupStatus;
  }
}

export const databaseMonitorService = new DatabaseMonitorService();