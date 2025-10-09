// import { Worker, Job } from 'bullmq';
// import prisma from '../config/database';
// import { EmailProviderService, EmailData } from '../services/emailProvider.services';
// import { logger } from '../utils/logger';
// import redisConfig  from '../config/redis';
// import { emailQueue } from '../services/campaign.services';

// // Initialize email provider service
// const emailProviderService = new EmailProviderService();

// // Create email worker
// const emailWorker = new Worker(
//   'emailQueue',
//   async (job: Job) => {
//     const { campaignId, emailId, domainId, isRetry = false } = job.data;
    
//     try {
//       logger.info(`Processing email job: ${job.id}, Campaign: ${campaignId}, Email: ${emailId}`);
      
//       // Get campaign details
//       const campaign = await prisma.campaign.findUnique({
//         where: { id: campaignId },
//         include: {
//           domain: true,
//         },
//       });
      
//       if (!campaign) {
//         throw new Error('Campaign not found');
//       }
      
//       // Get email details
//       const email = await prisma.email.findUnique({
//         where: { id: emailId },
//       });
      
//       if (!email) {
//         throw new Error('Email not found');
//       }
      
//       // Get email send record
//       const emailSend = await prisma.emailSend.findFirst({
//         where: {
//           campaignId,
//           emailId,
//         },
//       });
      
//       if (!emailSend) {
//         throw new Error('Email send record not found');
//       }
      
//       // Update status to SENDING
//       await prisma.emailSend.update({
//         where: { id: emailSend.id },
//         data: { status: 'SENT' },
//       });
      
//       // Prepare email data
//       const emailData: EmailData = {
//         to: email.address,
//         from: `noreply@${campaign.domain.domain}`,
//         subject: campaign.subject,
//         html: campaign.content,
//       };
      
//       // Send email
//       const result = await emailProviderService.sendEmail(emailData);
      
//       if (result.success) {
//         // Update status to DELIVERED
//         await prisma.emailSend.update({
//           where: { id: emailSend.id },
//           data: {
//             status: 'DELIVERED',
//           },
//         });
        
//         logger.info(`Email sent successfully to ${email.address}`);
        
//         // Update domain reputation (simplified)
//         // In a real app, this would be more sophisticated
//         await prisma.domain.update({
//           where: { id: domainId },
//           data: {
//             reputation: {
//               increment: isRetry ? 0.5 : 1,
//             },
//           },
//         });
        
//         return { success: true };
//       } else {
//         // Update status to FAILED
//         await prisma.emailSend.update({
//           where: { id: emailSend.id },
//           data: {
//             status: 'FAILED',
//             bounceReason: result.error,
//           },
//         });
        
//         logger.error(`Failed to send email to ${email.address}: ${result.error}`);
        
//         // Update domain reputation (simplified)
//         await prisma.domain.update({
//           where: { id: domainId },
//           data: {
//             reputation: {
//               decrement: 0.5,
//             },
//           },
//         });
        
//         throw new Error(result.error);
//       }
//     } catch (error) {
//       logger.error(`Email job failed: ${job.id}`, error);
      
//       // Update email send status to FAILED if not already updated
//       try {
//         const emailSend = await prisma.emailSend.findFirst({
//           where: {
//             campaignId,
//             emailId,
//           },
//         });
        
//         if (emailSend && emailSend.status !== 'FAILED') {
//           await prisma.emailSend.update({
//             where: { id: emailSend.id },
//             data: {
//               status: 'FAILED',
//               bounceReason: error instanceof Error ? error.message : 'Unknown error',
//             },
//           });
//         }
//       } catch (updateError) {
//         logger.error('Failed to update email send status:', updateError);
//       }
      
//       throw error;
//     }
//   },
//   {
//     connection: emailQueue.opts.connection,
//     concurrency: 10, // Process 10 jobs concurrently
//   }
// );

// // Handle worker events
// emailWorker.on('completed', (job) => {
//   logger.info(`Email job completed: ${job.id}`);
// });

// emailWorker.on('failed', (job, err) => {
//   logger.error(`Email job failed: ${job?.id}`, err);
// });

// emailWorker.on('error', (err) => {
//   logger.error('Email worker error:', err);
// });

// export default emailWorker;











import { Worker, Job } from 'bullmq';
import prisma from '../config/database';
import { EmailProviderService, EmailData } from '../services/emailProvider.services';
import { EmailProviderFactory } from '../providers/email.factory';
import { logger } from '../utils/logger';
import { emailQueue } from '../services/campaign.services';

// Initialize email provider service
const emailProviderService = new EmailProviderService();

// Helper function to get provider configuration for domain
const configureProviderForDomain = async (domainId: string) => {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId }
  });
  
  if (!domain) throw new Error('Domain not found');
  
  const providerName = domain.smtpProvider?.toLowerCase() || 'nodemailer';
  
  let providerConfig;
  
  if (providerName === 'nodemailer' && domain.smtpHost) {
    // Custom SMTP configuration
    providerConfig = {
      name: 'nodemailer',
      transport: {
        host: domain.smtpHost,
        port: domain.smtpPort || 587,
        secure: domain.smtpSecurity === 'SSL' || domain.smtpSecurity === 'TLS',
        auth: domain.smtpUsername ? {
          user: domain.smtpUsername,
          pass: domain.smtpPassword
        } : undefined
      },
      defaultFrom: `noreply@${domain.domain}`
    };
  } else if (providerName === 'resend') {
    // Resend configuration
    providerConfig = {
      name: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      defaultFrom: `noreply@${domain.domain}`
    };
  } else if (providerName === 'mailtrap') {
    // Mailtrap configuration
    providerConfig = {
      name: 'mailtrap',
      apiKey: process.env.MAILTRAP_API_KEY,
      defaultFrom: `noreply@${domain.domain}`
    };
  } else {
    throw new Error(`Unsupported or misconfigured provider: ${providerName}`);
  }
  
  return EmailProviderFactory.createProvider(providerConfig);
};

// Create email worker
const emailWorker = new Worker(
  'emailQueue',
  async (job: Job) => {
    const { campaignId, emailId, domainId, isRetry = false } = job.data;
    
    try {
      logger.info(`Processing email job: ${job.id}, Campaign: ${campaignId}, Email: ${emailId}`);
      
      // Get campaign details with domain
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          domain: true,
        },
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Get email details
      const email = await prisma.email.findUnique({
        where: { id: emailId },
      });
      
      if (!email) {
        throw new Error('Email not found');
      }
      
      // Get email send record
      const emailSend = await prisma.emailSend.findFirst({
        where: {
          campaignId,
          emailId,
        },
      });
      
      if (!emailSend) {
        throw new Error('Email send record not found');
      }
      
      // Configure provider based on domain SMTP settings
      const provider = await configureProviderForDomain(domainId);
      const providerName = campaign.domain.smtpProvider?.toLowerCase() || 'nodemailer';
      
      // Prepare email data
      const emailData: EmailData = {
        to: email.address,
        from: `noreply@${campaign.domain.domain}`,
        subject: campaign.subject,
        html: campaign.content,
      };
      
      // Send email with domain-specific provider
      const result = await provider.send(emailData);
      
      if (result.messageId) {
        // Update status to DELIVERED
        await prisma.emailSend.update({
          where: { id: emailSend.id },
          data: {
            status: 'DELIVERED',
          },
        });
        
        // Create email tracking record
        await prisma.emailTracking.upsert({
          where: {
            email_jobId: {
              email: email.address,
              jobId: job.id!,
            },
          },
          update: {
            status: 'sent',
            messageId: result.messageId,
            provider: providerName,
          },
          create: {
            email: email.address,
            jobId: job.id!,
            messageId: result.messageId || 'unknown',
            provider: providerName,
            status: 'sent',
            events: [
              {
                type: 'sent',
                timestamp: new Date(),
                data: { provider: providerName },
              },
            ],
          },
        });
        
        logger.info(`Email sent successfully to ${email.address} using ${providerName}`);
        
        // Update domain reputation (simplified)
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            reputation: {
              increment: isRetry ? 0.5 : 1,
            },
          },
        });
        
        return { 
          success: true, 
          provider: providerName,
          messageId: result.messageId 
        };
      } else {
        // Update status to FAILED
        await prisma.emailSend.update({
          where: { id: emailSend.id },
          data: {
            status: 'FAILED',
            bounceReason: 'Failed to get message ID from provider',
          },
        });
        
        // Create failed tracking record
        await prisma.emailTracking.upsert({
          where: {
            email_jobId: {
              email: email.address,
              jobId: job.id!,
            },
          },
          update: {
            status: 'bounced',
            provider: providerName,
          },
          create: {
            email: email.address,
            jobId: job.id!,
            messageId: 'failed',
            provider: providerName,
            status: 'bounced',
            events: [
              {
                type: 'bounced',
                timestamp: new Date(),
                data: { error: 'No message ID returned', provider: providerName },
              },
            ],
          },
        });
        
        logger.error(`Failed to send email to ${email.address} using ${providerName}: No message ID returned`);
        
        // Update domain reputation
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            reputation: {
              decrement: 0.5,
            },
          },
        });
        
        throw new Error('Failed to send email - no message ID returned from provider');
      }
    } catch (error) {
      logger.error(`Email job failed: ${job.id}`, error);
      
      // Update email send status to FAILED if not already updated
      try {
        const emailSend = await prisma.emailSend.findFirst({
          where: {
            campaignId,
            emailId,
          },
        });
        
        if (emailSend && emailSend.status !== 'FAILED') {
          await prisma.emailSend.update({
            where: { id: emailSend.id },
            data: {
              status: 'FAILED',
              bounceReason: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      } catch (updateError) {
        logger.error('Failed to update email send status:', updateError);
      }
      
      throw error;
    }
  },
  {
    connection: emailQueue.opts.connection,
    concurrency: 10, // Process 10 jobs concurrently
  }
);

// Handle worker events
emailWorker.on('completed', (job) => {
  logger.info(`Email job completed: ${job.id} with provider: ${job.returnvalue?.provider}`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job failed: ${job?.id}`, err);
});

emailWorker.on('error', (err) => {
  logger.error('Email worker error:', err);
});

export default emailWorker;