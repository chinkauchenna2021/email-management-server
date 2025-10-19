import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { EmailProviderFactory, IEmailProvider } from '../providers/email.factory';
import { EmailProviderConfig, EmailMessage } from '../types/email.types';
import { config } from 'dotenv';
config();

class DatabaseMonitorService {
  private isRunning = false;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_BASE = 15 * 60 * 1000; // 15 minutes base delay
  private readonly BATCH_SIZE = 10;

  startMonitoring() {
    logger.info('Starting database monitoring service...');

    // Primary monitor - runs every 30 seconds for immediate processing
    cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        logger.debug('Database monitor is already running, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        await this.processCampaignsImmediately();
        await this.checkFailedEmailsForRetry();
        await this.cleanupStalledJobs();
      } catch (error) {
        logger.error('Error in database monitoring:', error);
      } finally {
        this.isRunning = false;
      }
    });

    // Secondary monitor - runs every minute for scheduled campaigns and maintenance
    cron.schedule('* * * * *', async () => {
      try {
        await this.processScheduledCampaigns();
        await this.checkStalledSendingCampaigns();
        await this.updateCampaignMetrics();
      } catch (error) {
        logger.error('Error in scheduled campaign processing:', error);
      }
    });

    logger.info('Database monitoring service started successfully');
  }

  /**
   * Main method to handle all campaign processing logic
   * Handles DRAFT campaigns immediately if not scheduled, or at scheduled time
   */
  private async processCampaignsImmediately() {
    try {
      // Get campaigns that should be processed immediately
      // const campaignsToProcess = await prisma.campaign.findMany({
      //   where: {
      //     OR: [
      //       {
      //         // DRAFT campaigns with no schedule (process immediately)
      //         status: 'DRAFT',
      //         scheduledAt: null
      //       },
      //       {
      //         // READY campaigns (manually triggered for immediate processing)
      //         status: 'READY'
      //       },
      //       {
      //         // DRAFT campaigns where schedule time has arrived
      //         status: 'DRAFT',
      //         scheduledAt: {
      //           lte: new Date()
      //         }
      //       }
      //     ]
      //   },
      //   include: {
      //     domain: {
      //       select: {
      //         id: true,
      //         domain: true,
      //         verified: true,
      //         smtpProvider: true,
      //         smtpHost: true,
      //         smtpPort: true,
      //         smtpUsername: true,
      //         smtpPassword: true,
      //         enableDomainWarmup: true,
      //         dailyLimit: true,
      //         reputation: true
      //       }
      //     },
      //     list: {
      //       include: {
      //         emails: {
      //           where: {
      //             valid: true
      //           }
      //         }
      //       }
      //     }
      //   },
      //   orderBy: [
      //     { scheduledAt: 'asc' }, // Process scheduled ones first
      //     { createdAt: 'asc' }    // Then older ones first
      //   ],
      //   take: 5 // Process in small batches to avoid overload
      // });
      // In DatabaseMonitorService - update processCampaignsImmediately method
      const campaignsToProcess = await prisma.campaign.findMany({
        where: {
          OR: [
            {
              status: 'DRAFT',
              scheduledAt: null
            },
            {
              status: 'READY'
            },
            {
              status: 'DRAFT',
              scheduledAt: {
                lte: new Date()
              }
            }
          ]
        },
        include: {
          domain: {
            select: {
              id: true,
              domain: true,
              verified: true,
              smtpProvider: true,
              smtpHost: true,
              smtpPort: true,
              smtpUsername: true,
              smtpPassword: true,
              fromEmail: true, // Make sure this is included
              enableDomainWarmup: true,
              dailyLimit: true,
              reputation: true
            }
          },
          list: {
            include: {
              emails: {
                where: {
                  valid: true
                }
              }
            }
          }
        },
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'asc' }
        ],
        take: 5
      });

      for (const campaign of campaignsToProcess) {
        await this.processSingleCampaign(campaign);
      }
    } catch (error) {
      logger.error('Error in processCampaignsImmediately:', error);
      throw error;
    }
  }

  /**
   * Process scheduled campaigns (runs every minute)
   */
  private async processScheduledCampaigns() {
    try {
      const scheduledCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: new Date()
          }
        },
        include: {
          domain: {
            select: {
              id: true,
              domain: true,
              verified: true,
              smtpProvider: true,
              smtpHost: true,
              smtpPort: true,
              smtpUsername: true,
              smtpPassword: true,
              enableDomainWarmup: true,
              dailyLimit: true,
              reputation: true
            }
          },
          list: {
            include: {
              emails: {
                where: {
                  valid: true
                }
              }
            }
          }
        },
        take: 5
      });

      for (const campaign of scheduledCampaigns) {
        await this.processSingleCampaign(campaign);
      }
    } catch (error) {
      logger.error('Error processing scheduled campaigns:', error);
    }
  }

  /**
   * Unified method to process a single campaign
   */
  private async processSingleCampaign(campaign: any) {
    const campaignId = campaign.id;
    const campaignName = campaign.name;
    const isScheduled = campaign.scheduledAt !== null;
    const originalStatus = campaign.status;

    logger.info(`Processing campaign: ${campaignId} - ${campaignName}`, {
      originalStatus,
      scheduledAt: campaign.scheduledAt,
      isScheduled,
      emailCount: campaign.list?.emails?.length || 0
    });

    try {
      // Validate domain before processing
    //   if (!await this.validateDomainForSending(campaign.domain)) {
    //     logger.error(`Domain validation failed for campaign ${campaignId}, marking as FAILED`);
    //     await prisma.campaign.update({
    //       where: { id: campaignId },
    //       data: { status: 'FAILED' }
    //     });
    //     return;
    //   }

      // Update campaign status to SENDING
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: 'SENDING',
          sentAt: new Date()
        }
      });

      // Process the emails
      await this.processCampaignEmailsDirectly(campaign);

      logger.info(`Successfully started processing campaign ${campaignId} with ${campaign.list.emails.length} emails`);

    } catch (error) {
      logger.error(`Failed to process campaign ${campaignId}:`, error);
      
      // Mark campaign as failed if processing fails
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: 'FAILED'
        }
      });
    }
  }

  /**
   * Process campaign emails in batches
   */
  private async processCampaignEmailsDirectly(campaign: any) {
    try {
      // Create or update bulk email job record
      const bulkJob = await prisma.bulkEmailJob.upsert({
        where: { campaignId: campaign.id },
        update: {
          status: 'processing',
          totalEmails: campaign.list.emails.length,
          processedEmails: 0,
          successCount: 0,
          failureCount: 0,
          startedAt: new Date()
        },
        create: {
          campaignId: campaign.id,
          userId: campaign.userId,
          provider: campaign.domain.smtpProvider || 'custom',
          status: 'processing',
          totalEmails: campaign.list.emails.length,
          processedEmails: 0,
          successCount: 0,
          failureCount: 0,
          startedAt: new Date()
        }
      });

      // Process emails in batches
      const batches = [];
      for (let i = 0; i < campaign.list.emails.length; i += this.BATCH_SIZE) {
        batches.push(campaign.list.emails.slice(i, i + this.BATCH_SIZE));
      }

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map((email: any) => this.sendSingleEmail(campaign, email, bulkJob.id))
        );
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`Processed ${campaign.list.emails.length} emails for campaign ${campaign.id}`);
    } catch (error) {
      logger.error(`Error processing campaign emails for ${campaign.id}:`, error);
      throw error;
    }
  }

  /**
   * Send single email with proper error handling and tracking
   */
  // private async sendSingleEmail(campaign: any, email: any, bulkJobId: string) {
  //   let emailSend = await prisma.emailSend.findFirst({
  //     where: {
  //       emailId: email.id,
  //       campaignId: campaign.id
  //     }
  //   });

  //   if (!emailSend) {
  //     emailSend = await prisma.emailSend.create({
  //       data: {
  //         emailId: email.id,
  //         campaignId: campaign.id,
  //         status: 'PENDING'
  //       }
  //     });
  //   } else {
  //     await prisma.emailSend.update({
  //       where: { id: emailSend.id },
  //       data: {
  //         status: 'PENDING',
  //         bounceReason: null,
  //         openedAt: null,
  //         clickedAt: null,
  //         bouncedAt: null,
  //         complainedAt: null,
  //         retries: 0
  //       }
  //     });
  //   }

  //   try {
  //     // Configure provider based on domain
  //     const provider = await this.configureProviderForDomain(campaign.domain);
  //     const providerName = campaign.domain.smtpProvider?.toLowerCase() || 'custom';







  //     //    FOUND BUG 🐛🐛🐛







  //     // Prepare email data - use domain name for from address if fromEmail is not set
  //   //   const fromEmail =  campaign.domain.fromEmail || `noreply@${campaign.domain.domain}`;

  //     const fromEmail =  (campaign.domain.smtpProvider.toLowerCase() === 'resend')?  process.env.DEFAULT_RESEND_FROM_EMAIL : (campaign.domain.smtpProvider.toLowerCase() === 'mailtrap')? process.env.DEFAULT_MAILTRAP_FROM_EMAIL :  `noreply@${campaign.domain.domain}` 
  //   //   const fromEmail =  campaign.
  //     const emailData: EmailMessage = {
  //       to: email.address,
  //       from: fromEmail,
  //       subject: campaign.subject,
  //       html: campaign.content,
  //     };

  //     logger.debug(`Sending email to ${email.address} using ${providerName}`);

  //     // Send email
  //     const result = await provider.send(emailData);

  //     if (result.messageId) {
  //       // Success - update email send record
  //       await prisma.emailSend.update({
  //         where: { id: emailSend.id },
  //         data: {
  //           status: 'SENT'
  //         }
  //       });

  //       // Create tracking record
  //       await prisma.emailTracking.create({
  //         data: {
  //           email: email.address,
  //           jobId: bulkJobId,
  //           messageId: result.messageId,
  //           provider: providerName,
  //           status: 'sent'
  //         }
  //       });

  //       // Update bulk job stats
  //       await this.updateBulkJobStats(bulkJobId, true);

  //       // Update domain reputation
  //       await prisma.domain.update({
  //         where: { id: campaign.domain.id },
  //         data: {
  //           reputation: {
  //             increment: 1
  //           }
  //         }
  //       });

  //       logger.info(`Email sent successfully to ${email.address} using ${providerName}`);
  //     } else {
  //       throw new Error('No message ID returned from provider');
  //     }

  //   } catch (error) {
  //     logger.error(`Failed to send email to ${email.address}:`, error);

  //     // Update email send record as failed
  //     await prisma.emailSend.update({
  //       where: { id: emailSend.id },
  //       data: {
  //         status: 'FAILED',
  //         bounceReason: error instanceof Error ? error.message : 'Unknown error',
  //         retries: { increment: 1 }
  //       }
  //     });

  //     // Update bulk job stats
  //     await this.updateBulkJobStats(bulkJobId, false);

  //     // Update domain reputation
  //     await prisma.domain.update({
  //       where: { id: campaign.domain.id },
  //       data: {
  //         reputation: {
  //           decrement: 0.5
  //         }
  //       }
  //     });
  //   }
  // }



// In your DatabaseMonitorService - fix the sendSingleEmail method

private async sendSingleEmail(campaign: any, email: any, bulkJobId: string) {
  let emailSend = await prisma.emailSend.findFirst({
    where: {
      emailId: email.id,
      campaignId: campaign.id
    }
  });

  if (!emailSend) {
    emailSend = await prisma.emailSend.create({
      data: {
        emailId: email.id,
        campaignId: campaign.id,
        status: 'PENDING'
      }
    });
  }

  try {
    // Configure provider based on domain
    const provider = await this.configureProviderForDomain(campaign.domain);
    const providerName = campaign.domain.smtpProvider?.toLowerCase() || 'custom';

    // Get from email from domain configuration
    let fromEmail: string;
    
    if (campaign.domain.fromEmail) {
      fromEmail = campaign.domain.fromEmail;
    } else {
      // Fallback logic based on provider
      switch (campaign.domain.smtpProvider?.toLowerCase()) {
        case 'resend':
          fromEmail = process.env.DEFAULT_RESEND_FROM_EMAIL || `noreply@${campaign.domain.domain}`;
          break;
        case 'mailtrap':
          fromEmail = process.env.DEFAULT_MAILTRAP_FROM_EMAIL || `noreply@${campaign.domain.domain}`;
          break;
        default:
          fromEmail = `noreply@${campaign.domain.domain}`;
      }
    }

    // Use the fromName from campaign data with the domain's fromEmail
    // const fromAddress = `${campaign.fromName} <${fromEmail}>`;
       const fromAddress = `${fromEmail}`;

    const emailData: EmailMessage = {
      to: email.address,
      from: fromAddress, // Use the formatted from address
      subject: campaign.subject,
      html: campaign.content,
    };

    logger.debug(`Sending email to ${email.address} from ${fromAddress} using ${providerName}`);

    // Send email
    const result = await provider.send(emailData);

    if (result.messageId) {
      // Success - update email send record
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: 'SENT'
        }
      });

      // Create tracking record
      await prisma.emailTracking.create({
        data: {
          email: email.address,
          jobId: bulkJobId,
          messageId: result.messageId,
          provider: providerName,
          status: 'sent'
        }
      });

      // Update bulk job stats
      await this.updateBulkJobStats(bulkJobId, true);

      logger.info(`Email sent successfully to ${email.address} from ${fromAddress} using ${providerName}`);
    } else {
      throw new Error('No message ID returned from provider');
    }

  } catch (error) {
    logger.error(`Failed to send email to ${email.address}:`, error);

    // Update email send record as failed
    await prisma.emailSend.update({
      where: { id: emailSend.id },
      data: {
        status: 'FAILED',
        bounceReason: error instanceof Error ? error.message : 'Unknown error',
        retries: { increment: 1 }
      }
    });

    // Update bulk job stats
    await this.updateBulkJobStats(bulkJobId, false);
  }
}


  /**
   * Configure email provider based on domain settings
   */
  private async configureProviderForDomain(domain: any): Promise<IEmailProvider> {
    const providerName = domain.smtpProvider?.toLowerCase() || 'custom';
    
    let providerConfig: EmailProviderConfig;

    switch (providerName) {
      case 'resend':
        providerConfig = {
          name: 'resend',
          apiKey: process.env.RESEND_API_KEY,
          defaultFrom: process.env.DEFAULT_RESEND_FROM_EMAIL
        };
        break;

      case 'mailtrap':
        providerConfig = {
          name: 'mailtrap',
          apiKey: process.env.MAILTRAP_API_KEY,
          defaultFrom: process.env.DEFAULT_MAILTRAP_FROM_EMAIL
        };
        break;

      case 'custom':
      default:
        if (!domain.smtpHost || !domain.smtpUsername || !domain.smtpPassword) {
          throw new Error('Custom SMTP configuration incomplete');
        }
        
        providerConfig = {
          name: 'nodemailer',
          transport: {
            host: domain.smtpHost,
            port: domain.smtpPort || 587,
            secure: domain.smtpPort === 465,
            auth: {
              user: domain.smtpUsername,
              pass: domain.smtpPassword
            }
          },
          defaultFrom:`noreply@${domain.domain}`
        };
        break;
    }

    return EmailProviderFactory.createProvider(providerConfig);
  }

  /**
   * Update bulk job statistics and handle completion
   */
  private async updateBulkJobStats(bulkJobId: string, success: boolean) {
    try {
      await prisma.bulkEmailJob.update({
        where: { id: bulkJobId },
        data: {
          processedEmails: { increment: 1 },
          ...(success 
            ? { successCount: { increment: 1 } }
            : { failureCount: { increment: 1 } }
          )
        }
      });

      // Check if all emails are processed
      const updatedJob = await prisma.bulkEmailJob.findUnique({
        where: { id: bulkJobId }
      });

      if (updatedJob && updatedJob.processedEmails >= updatedJob.totalEmails) {
        await prisma.bulkEmailJob.update({
          where: { id: bulkJobId },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        });

        // Update campaign status to SENT
        await prisma.campaign.update({
          where: { 
            id: updatedJob.campaignId
          },
          data: {
            status: 'SENT'
          }
        });
      }
    } catch (error) {
      logger.error('Error updating bulk job stats:', error);
    }
  }

  /**
   * Validate domain for sending
   */
  // private async validateDomainForSending(domain: any): Promise<boolean> {
  //   try {
  //     const validProviders = ['custom', 'resend', 'mailtrap'];
      
  //     if (!domain.smtpProvider || !validProviders.includes(domain.smtpProvider)) {
  //       logger.error(`Invalid SMTP provider for domain ${domain.id}: ${domain.smtpProvider}`);
  //       return false;
  //     }

  //     // Check provider-specific requirements
  //     switch (domain.smtpProvider) {
  //       case 'custom':
  //         if (!domain.verified) {
  //           logger.error(`Domain ${domain.id} is not verified for custom SMTP`);
  //           return false;
  //         }
  //         if (!domain.smtpHost || !domain.smtpUsername || !domain.smtpPassword) {
  //           logger.error(`Custom SMTP configuration incomplete for domain ${domain.id}`);
  //           return false;
  //         }
  //         break;
        
  //       case 'resend':
  //       case 'mailtrap':
  //         // For these providers, we mainly need the API keys from environment
  //         if (!process.env[`${domain.smtpProvider.toUpperCase()}_API_KEY`]) {
  //           logger.error(`API key missing for ${domain.smtpProvider} provider`);
  //           return false;
  //         }
  //         break;
  //     }

  //     // Check domain warmup limits if enabled
  //     if (domain.enableDomainWarmup) {
  //       const warmupStatus = await this.checkDomainWarmupStatus(domain.id);
  //       if (warmupStatus.isInWarmup && warmupStatus.sentLast30Days >= warmupStatus.dailyLimit) {
  //         logger.warn(`Domain ${domain.id} daily warmup limit reached: ${warmupStatus.sentLast30Days}/${warmupStatus.dailyLimit}`);
  //         return false;
  //       }
  //     }

  //     return true;
  //   } catch (error) {
  //     logger.error(`Error validating domain ${domain.id}:`, error);
  //     return false;
  //   }
  // }

  private async validateDomainForSending(domain: any): Promise<boolean> {
  try {
    const validProviders = ['custom', 'resend', 'mailtrap'];
    
    if (!domain.smtpProvider || !validProviders.includes(domain.smtpProvider.toLowerCase())) {
      logger.error(`Invalid SMTP provider for domain ${domain.id}: ${domain.smtpProvider}`);
      return false;
    }

    // Check provider-specific requirements
    switch (domain.smtpProvider.toLowerCase()) {
      case 'custom':
        if (!domain.verified) {
          logger.error(`Domain ${domain.id} is not verified for custom SMTP`);
          return false;
        }
        if (!domain.fromEmail) {
          logger.error(`Domain ${domain.id} must have a from email address configured`);
          return false;
        }
        if (!domain.smtpHost || !domain.smtpUsername || !domain.smtpPassword) {
          logger.error(`Custom SMTP configuration incomplete for domain ${domain.id}`);
          return false;
        }
        break;
      
      case 'resend':
      case 'mailtrap':
        // For these providers, we mainly need the API keys from environment
        const apiKeyEnv = `${domain.smtpProvider.toUpperCase()}_API_KEY`;
        if (!process.env[apiKeyEnv]) {
          logger.error(`API key missing for ${domain.smtpProvider} provider`);
          return false;
        }
        break;
    }

    // Check domain warmup limits if enabled
    if (domain.enableDomainWarmup) {
      const warmupStatus = await this.checkDomainWarmupStatus(domain.id);
      if (warmupStatus.isInWarmup && warmupStatus.sentLast30Days >= warmupStatus.dailyLimit) {
        logger.warn(`Domain ${domain.id} daily warmup limit reached: ${warmupStatus.sentLast30Days}/${warmupStatus.dailyLimit}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error(`Error validating domain ${domain.id}:`, error);
    return false;
  }
}

  /**
   * Check domain warmup status
   */
  async checkDomainWarmupStatus(domainId: string) {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        campaigns: {
          where: {
            status: 'SENT',
            sentAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          include: {
            list: {
              include: {
                emails: {
                  where: {
                    valid: true
                  }
                }
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
      isInWarmup: domain.enableDomainWarmup && sentLast30Days < 1000
    };

    return warmupStatus;
  }

  // ... Rest of your methods (checkStalledSendingCampaigns, checkFailedEmailsForRetry, etc.)
  // Keep the existing implementations but make sure they use the correct Prisma schema fields

  private async checkStalledSendingCampaigns() {
    try {
      const stalledCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'SENDING',
          sentAt: {
            lte: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
          }
        },
        include: {
          domain: true,
          sends: {
            where: {
              status: {
                in: ['PENDING', 'RETRYING', 'FAILED']
              }
            }
          }
        }
      });

      for (const campaign of stalledCampaigns) {
        logger.warn(`Found stalled campaign: ${campaign.id} - ${campaign.name}`);

        // Check if there are still pending/failed emails
        if (campaign.sends.length > 0) {
          logger.info(`Restarting ${campaign.sends.length} emails for stalled campaign ${campaign.id}`);
          
          // Get fresh campaign data with list and emails
          const freshCampaign = await prisma.campaign.findUnique({
            where: { id: campaign.id },
            include: {
              domain: true,
              list: {
                include: {
                  emails: {
                    where: {
                      valid: true
                    }
                  }
                }
              }
            }
          });

          if (freshCampaign) {
            await this.processCampaignEmailsDirectly(freshCampaign);
          }
        } else {
          // No pending emails, mark campaign as SENT
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'SENT' }
          });
          logger.info(`Marked stalled campaign ${campaign.id} as SENT (no pending emails)`);
        }
      }
    } catch (error) {
      logger.error('Error checking stalled campaigns:', error);
      throw error;
    }
  }

  private async checkFailedEmailsForRetry() {
    try {
      const failedEmails = await prisma.emailSend.findMany({
        where: {
          status: 'FAILED',
          retries: {
            lt: this.MAX_RETRY_ATTEMPTS
          },
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
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
        const retryDelay = Math.pow(2, emailSend.retries) * this.RETRY_DELAY_BASE;
        
        if (Date.now() - emailSend.updatedAt.getTime() >= retryDelay) {
        //   if (!await this.validateDomainForSending(emailSend.campaign.domain)) {
        //     logger.warn(`Domain validation failed for retry, email ${emailSend.id}`);
        //     continue;  
        //   }

          // Retry the failed email directly
          await this.sendSingleEmail(
            emailSend.campaign, 
            emailSend.email, 
            emailSend.campaignId
          );

          logger.info(`Retried failed email: ${emailSend.email.address}, attempt: ${emailSend.retries + 1}`);
        }
      }
    } catch (error) {
      logger.error('Error checking failed emails for retry:', error);
      throw error;
    }
  }

  private async cleanupStalledJobs() {
    try {
      const stalledSends = await prisma.emailSend.findMany({
        where: {
          status: 'RETRYING',
          updatedAt: {
            lte: new Date(Date.now() - 10 * 60 * 1000)
          }
        }
      });

      for (const send of stalledSends) {
        logger.warn(`Marking stalled email send as FAILED: ${send.id}`);
        await prisma.emailSend.update({
          where: { id: send.id },
          data: { status: 'FAILED' }
        });
      }
    } catch (error) {
      logger.error('Error cleaning up stalled jobs:', error);
    }
  }

  private async updateCampaignMetrics() {
    try {
      const sendingCampaigns = await prisma.campaign.findMany({
        where: { status: 'SENDING' },
        include: {
          sends: {
            select: { status: true }
          }
        }
      });

      for (const campaign of sendingCampaigns) {
        const sends = campaign.sends;
        const totalSends = sends.length;
        const completedSends = sends.filter(s => 
          ['SENT', 'BOUNCED', 'FAILED'].includes(s.status)
        ).length;

        if (totalSends > 0 && completedSends === totalSends) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'SENT' }
          });
          logger.info(`Marked campaign ${campaign.id} as SENT (all emails processed)`);
        }
      }
    } catch (error) {
      logger.error('Error updating campaign metrics:', error);
    }
  }

  /**
   * API method to manually trigger a DRAFT campaign immediately
   */
  async triggerDraftCampaignImmediately(campaignId: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'DRAFT') {
        throw new Error(`Campaign must be in DRAFT status. Current status: ${campaign.status}`);
      }

      // Override any schedule and mark as READY for immediate processing
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          scheduledAt: null, // Clear any existing schedule
          status: 'READY' // Mark as ready for immediate processing
        }
      });

      logger.info(`Manually triggered DRAFT campaign for immediate processing: ${campaignId}`);

      return { 
        success: true, 
        message: 'Campaign queued for immediate processing',
        campaignId 
      };

    } catch (error) {
      logger.error(`Error triggering campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * API method to schedule a DRAFT campaign
   */
  async scheduleDraftCampaign(campaignId: string, scheduleDate: Date) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'DRAFT') {
        throw new Error(`Campaign must be in DRAFT status. Current status: ${campaign.status}`);
      }

      if (scheduleDate <= new Date()) {
        throw new Error('Schedule date must be in the future');
      }

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          scheduledAt: scheduleDate,
          status: 'SCHEDULED'
        }
      });

      logger.info(`Scheduled campaign ${campaignId} for ${scheduleDate}`);
      return { 
        success: true, 
        message: 'Campaign scheduled successfully',
        scheduledAt: scheduleDate 
      };

    } catch (error) {
      logger.error(`Error scheduling campaign ${campaignId}:`, error);
      throw error;
    }
  }
}

export const databaseMonitorService = new DatabaseMonitorService();