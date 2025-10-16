import {prisma} from "../config/database";
import { logger } from "../utils/logger";
import { Queue } from "bullmq";
import redisClient from "../config/redis";
import { CampaignScheduler } from "./campaignScheduler";

// Create email queue
export const emailQueue = new Queue("emailQueue", {
  connection: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,

  },
});

// redis-cli --tls -u redis://default:AVf5AAIncDI5OTc2ZWI3ZDA4Y2Q0OTcwYmNiOWViYmU2MzdhODk5MnAyMjI1MjE@touched-falcon-22521.upstash.io:6379
  //   host: "fly-withered-wildflower-4438.upstash.io",
  // port: 6379,
  // username: "default",
  // password: "******",
  // family: 6,
export class CampaignService {
  /**
   * Create a new campaign
   */
  // static async createCampaign(
  //   userId: string,
  //   name: string,
  //   subject: string,
  //   content: string,
  //   domainId: string,
  //   listId: string,
  //   templateId?: string,
  //   scheduledAt?: Date,
  //   saveAsDraft: boolean = false
  // ) {
  //   try {
  //     // Check if domain exists and belongs to user
  //     const domain = await prisma.domain.findFirst({
  //       where: { id: domainId, userId },
  //     });

  //     if (!domain) {
  //       throw new Error("Domain not found");
  //     }

  //     // Check if domain has SMTP configuration
  //     if (!domain.smtpProvider && !saveAsDraft) {
  //       throw new Error("Domain must have SMTP configuration to send emails");
  //     }

  //     // Check if domain is verified (only for custom SMTP, not for transactional providers like Resend)
  //     if (
  //       !domain.verified &&
  //       !saveAsDraft &&
  //       domain.smtpProvider?.toLowerCase() !== "resend"
  //     ) {
  //       throw new Error("Domain must be verified for custom SMTP sending");
  //     }

  //     // Check if email list exists and belongs to user
  //     const emailList = await prisma.emailList.findFirst({
  //       where: { id: listId, userId },
  //     });

  //     if (!emailList) {
  //       throw new Error("Email list not found");
  //     }

  //     // Validate template if provided
  //     if (templateId) {
  //       const template = await prisma.emailTemplate.findFirst({
  //         where: { id: templateId, userId },
  //       });

  //       if (!template) throw new Error("Template not found");

  //       // Use template subject/content if not provided
  //       subject = subject || template.subject;
  //       content = content || template.content;
  //     }

  //     // Create campaign
  //     const campaign = await prisma.campaign.create({
  //       data: {
  //         userId,
  //         name,
  //         subject,
  //         content,
  //         domainId,
  //         listId,
  //         templateId,
  //         scheduledAt,
  //         status: saveAsDraft ? "DRAFT" : scheduledAt ? "SCHEDULED" : "READY",
  //       },
  //     });

  //     return campaign;
  //   } catch (error) {
  //     logger.error("Create campaign error:", error);
  //     throw error;
  //   }
  // }



// Add this method to your CampaignService class

// In CampaignService - update createCampaign and updateCampaign methods

static async createCampaign(
  userId: string,
  name: string,
  subject: string,
  content: string,
  domainId: string,
  listId: string,
  templateId?: string,
  scheduledAt?: Date,
  saveAsDraft: boolean = false
) {
  try {
    // Check if domain exists and belongs to user
    const domain = await prisma.domain.findFirst({
      where: { id: domainId, userId },
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    // Check if domain has from email configured for custom SMTP
    if (!domain.fromEmail && domain.smtpProvider?.toLowerCase() === 'custom' && !saveAsDraft) {
      throw new Error("Domain must have a from email address configured for custom SMTP");
    }

    // Check if domain has SMTP configuration
    if (!domain.smtpProvider && !saveAsDraft) {
      throw new Error("Domain must have SMTP configuration to send emails");
    }

    // Check if domain is verified (only for custom SMTP)
    if (
      !domain.verified &&
      !saveAsDraft &&
      domain.smtpProvider?.toLowerCase() !== "resend" &&
      domain.smtpProvider?.toLowerCase() !== "mailtrap"
    ) {
      throw new Error("Domain must be verified for custom SMTP sending");
    }

    // Rest of the method remains the same...
    // Check if email list exists and belongs to user
    const emailList = await prisma.emailList.findFirst({
      where: { id: listId, userId },
    });

    if (!emailList) {
      throw new Error("Email list not found");
    }

    // Validate template if provided
    if (templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, userId },
      });

      if (!template) throw new Error("Template not found");

      // Use template subject/content if not provided
      subject = subject || template.subject;
      content = content || template.content;
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
        templateId,
        scheduledAt,
        status: saveAsDraft ? "DRAFT" : scheduledAt ? "SCHEDULED" : "READY",
      },
    });

    return campaign;
  } catch (error) {
    logger.error("Create campaign error:", error);
    throw error;
  }
}



static async deleteCampaign(userId: string, campaignId: string) {
  try {
    // Check if campaign exists and belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Prevent deletion of campaigns that are currently sending
    if (campaign.status === 'SENDING') {
      throw new Error('Cannot delete a campaign that is currently sending');
    }

    // Delete the campaign
    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    // Unschedule if it was scheduled
    const scheduler = CampaignScheduler.getInstance();
    scheduler.unscheduleCampaign(campaignId);

    return { message: 'Campaign deleted successfully' };
  } catch (error) {
    logger.error('Delete campaign error:', error);
    throw error;
  }
}




  /**
   * Update a campaign
   */
  static async updateCampaign(
    userId: string,
    campaignId: string,
    name?: string,
    subject?: string,
    content?: string,
    domainId?: string,
    listId?: string,
    templateId?: string,
    scheduledAt?: Date,
    saveAsDraft: boolean = false
  ) {
    try {
      // Check if campaign exists and belongs to user
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // If campaign is already sent, don't allow updates
      if (campaign.status === "SENT" || campaign.status === "SENDING") {
        throw new Error("Cannot update a campaign that has already been sent");
      }

      // Check if domain exists and belongs to user (if provided)
      if (domainId) {
        const domain = await prisma.domain.findFirst({
          where: { id: domainId, userId },
        });

        if (!domain) {
          throw new Error("Domain not found");
        }

        // Check if domain has SMTP configuration
        if (!domain.smtpProvider && !saveAsDraft) {
          throw new Error("Domain must have SMTP configuration to send emails");
        }

        // Check if domain is verified
        if (
          !domain.verified &&
          !saveAsDraft &&
          domain.smtpProvider?.toLowerCase() !== "resend"
        ) {
          throw new Error("Domain is not verified");
        }
      }

      // Check if email list exists and belongs to user (if provided)
      if (listId) {
        const emailList = await prisma.emailList.findFirst({
          where: { id: listId, userId },
        });

        if (!emailList) {
          throw new Error("Email list not found");
        }
      }

      // Validate template if provided
      if (templateId) {
        const template = await prisma.emailTemplate.findFirst({
          where: { id: templateId, userId },
        });

        if (!template) throw new Error("Template not found");
      }

      // Update campaign
      const updatedCampaign = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          ...(name && { name }),
          ...(subject && { subject }),
          ...(content && { content }),
          ...(domainId && { domainId }),
          ...(listId && { listId }),
          ...(templateId !== undefined && { templateId }),
          ...(scheduledAt !== undefined && { scheduledAt }),
          status: saveAsDraft ? "DRAFT" : scheduledAt ? "SCHEDULED" : "READY",
        },
      });

      return updatedCampaign;
    } catch (error) {
      logger.error("Update campaign error:", error);
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
        throw new Error("Campaign not found");
      }

      const stats = await prisma.emailSend.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: {
          status: true,
        },
      });

      const statusCounts = stats.reduce(
        (
          acc: { [x: string]: any },
          stat: { status: string | number; _count: { status: any } }
        ) => {
          acc[stat.status] = stat._count.status;
          return acc;
        },
        {} as Record<string, number>
      );

      const totalEmails = Object.values(statusCounts).reduce(
        (sum, count) => Number(sum) + Number(count),
        0
      );
      const delivered = statusCounts.DELIVERED || 0;
      const bounced = statusCounts.BOUNCED || 0;
      const opened = statusCounts.OPENED || 0;
      const clicked = statusCounts.CLICKED || 0;

      const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
      const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

      return {
        campaignId,
        status: campaign.status,
        stats: {
          totalEmails,
          delivered,
          bounced,
          opened,
          clicked,
          openRate: parseFloat(openRate.toFixed(2)),
          clickRate: parseFloat(clickRate.toFixed(2)),
          pending: statusCounts.PENDING || 0,
          failed: statusCounts.FAILED || 0,
        },
      };
    } catch (error) {
      logger.error("Get campaign stats error:", error);
      throw error;
    }
  }

  /**
   * Get overall campaign statistics
   */
  static async getOverallCampaignStats(userId: string) {
    try {
      // Get all campaigns for the user
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
      });

      const totalCampaigns = campaigns.length;

      // Get all email sends for the user
      const emailSends = await prisma.emailSend.findMany({
        where: {
          campaign: {
            userId: userId,
          },
        },
      });

      const totalEmailsSent = emailSends.length;
      const delivered = emailSends.filter(
        (send) => send.status === "DELIVERED"
      ).length;
      const opened = emailSends.filter(
        (send) => send.status === "OPENED"
      ).length;
      const clicked = emailSends.filter(
        (send) => send.status === "CLICKED"
      ).length;

      const averageOpenRate = delivered > 0 ? (opened / delivered) * 100 : 0;
      const averageClickRate = opened > 0 ? (clicked / opened) * 100 : 0;

      return {
        totalCampaigns,
        totalEmailsSent,
        averageOpenRate: parseFloat(averageOpenRate.toFixed(2)),
        averageClickRate: parseFloat(averageClickRate.toFixed(2)),
      };
    } catch (error) {
      logger.error("Get overall campaign stats error:", error);
      throw error;
    }
  }

  /**
   * Get filtered campaigns
   */
  static async getFilteredCampaigns(
    userId: string,
    page = 1,
    limit = 20,
    status?: string,
    domainId?: string,
    listId?: string
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = { userId };
      if (status) whereClause.status = status;
      if (domainId) whereClause.domainId = domainId;
      if (listId) whereClause.listId = listId;

      const [campaigns, totalCount] = await Promise.all([
        prisma.campaign.findMany({
          where: whereClause,
          include: {
            domain: true,
            list: true,
            template: true,
            _count: {
              select: { sends: true },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.campaign.count({
          where: whereClause,
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
      logger.error("Get filtered campaigns error:", error);
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
            template: true,
            _count: {
              select: { sends: true },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
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
      logger.error("Get user campaigns error:", error);
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
          template: true,
          sends: {
            include: {
              email: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      return campaign;
    } catch (error) {
      logger.error("Get campaign details error:", error);
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
        throw new Error("Campaign not found");
      }

      // Check if domain has SMTP configuration
      if (!campaign.domain.smtpProvider) {
        throw new Error("Domain must have SMTP configuration to send emails");
      }

      // Check if domain is verified (only for custom SMTP)
      if (
        !campaign.domain.verified &&
        campaign.domain.smtpProvider?.toLowerCase() !== "resend"
      ) {
        throw new Error("Domain must be verified for custom SMTP sending");
      }

      // Update campaign status
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "SENDING",
          sentAt: new Date(),
        },
      });

      // Create email send records for each email
      const emailSends = await prisma.emailSend.createMany({
        data: campaign.list.emails.map((email: { id: any }) => ({
          emailId: email.id,
          campaignId: campaign.id,
        })),
      });

      // Add email sending jobs to queue
      for (const email of campaign.list.emails) {
        await emailQueue.add(
          "sendEmail",
          {
            campaignId: campaign.id,
            emailId: email.id,
            domainId: campaign.domain.id,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
          }
        );
      }

      return { message: "Campaign sending started" };
    } catch (error) {
      logger.error("Send campaign error:", error);
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
        throw new Error("Campaign not found");
      }

      // Get failed email sends
      const failedSends = await prisma.emailSend.findMany({
        where: {
          campaignId,
          status: { in: ["FAILED", "BOUNCED"] },
        },
      });

      if (failedSends.length === 0) {
        return { message: "No failed emails to retry" };
      }

      // Update status to RETRYING
      await prisma.emailSend.updateMany({
        where: {
          id: { in: failedSends.map((send: { id: any }) => send.id) },
        },
        data: {
          status: "RETRYING",
          retries: { increment: 1 },
        },
      });

      // Add retry jobs to queue
      for (const send of failedSends) {
        await emailQueue.add(
          "sendEmail",
          {
            campaignId,
            emailId: send.emailId,
            domainId: campaign.domainId,
            isRetry: true,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
          }
        );
      }

      return {
        message: `Retrying ${failedSends.length} failed emails`,
        retryCount: failedSends.length,
      };
    } catch (error) {
      logger.error("Retry failed emails error:", error);
      throw error;
    }
  }

  static async sendScheduledCampaign(campaign: any): Promise<void> {
    try {
      // Create email send records for each email
      const emailSends = await prisma.emailSend.createMany({
        data: campaign.list.emails.map((email: { id: any }) => ({
          emailId: email.id,
          campaignId: campaign.id,
        })),
      });

      // Add email sending jobs to queue
      for (const email of campaign.list.emails) {
        await emailQueue.add(
          "sendEmail",
          {
            campaignId: campaign.id,
            emailId: email.id,
            domainId: campaign.domain.id,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
          }
        );
      }

      // Update campaign status to SENT after all emails are queued
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "SENT" },
      });

      logger.info(`Campaign ${campaign.id} sent successfully`);
    } catch (error) {
      logger.error(`Error sending scheduled campaign ${campaign.id}:`, error);

      // Mark campaign as failed
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED" },
      });

      throw error;
    }
  }
}
