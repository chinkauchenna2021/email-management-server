// import * as sgMail from '@sendgrid/mail';
// import * as mailgun from 'mailgun-js';
// import AWS from 'aws-sdk';
// import { logger } from '../utils/logger';

// // Initialize email providers
// sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
// const mg = mailgun.default({
//   apiKey: process.env.MAILGUN_API_KEY!,
//   domain: process.env.MAILGUN_DOMAIN!,
// });
// const ses = new AWS.SES({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   region: process.env.AWS_REGION!,
// });

// export interface EmailProvider {
//   name: string;
//   sendEmail: (data: EmailData) => Promise<EmailResult>;
// }

// export interface EmailData {
//   to: string;
//   from: string;
//   subject: string;
//   text?: string;
//   html: string;
// }

// export interface EmailResult {
//   success: boolean;
//   messageId?: string;
//   error?: string;
// }

// class SendGridProvider implements EmailProvider {
//   name = 'SendGrid';
  
//   async sendEmail(data: EmailData): Promise<EmailResult> {
//     try {
//       const msg = {
//         to: data.to,
//         from: data.from,
//         subject: data.subject,
//         text: data.text,
//         html: data.html,
//       };
      
//       const result = await sgMail.send(msg);
      
//       return {
//         success: true,
//         messageId: result[0].headers['x-message-id'],
//       };
//     } catch (error) {
//       logger.error('SendGrid error:', error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown SendGrid error',
//       };
//     }
//   }
// }

// class MailgunProvider implements EmailProvider {
//   name = 'Mailgun';
  
//   async sendEmail(data: EmailData): Promise<EmailResult> {
//     try {
//       const result = await mg.messages().send({
//         to: data.to,
//         from: data.from,
//         subject: data.subject,
//         text: data.text,
//         html: data.html,
//       });
      
//       return {
//         success: true,
//         messageId: result.id,
//       };
//     } catch (error) {
//       logger.error('Mailgun error:', error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown Mailgun error',
//       };
//     }
//   }
// }

// class SESProvider implements EmailProvider {
//   name = 'SES';
  
//   async sendEmail(data: EmailData): Promise<EmailResult> {
//     try {
//       const params = {
//         Destination: {
//           ToAddresses: [data.to],
//         },
//         Message: {
//           Body: {
//             Html: {
//               Charset: 'UTF-8',
//               Data: data.html,
//             },
//             ...(data.text && {
//               Text: {
//                 Charset: 'UTF-8',
//                 Data: data.text,
//               },
//             }),
//           },
//           Subject: {
//             Charset: 'UTF-8',
//             Data: data.subject,
//           },
//         },
//         Source: data.from,
//       };
      
//       const result = await ses.sendEmail(params).promise();
      
//       return {
//         success: true,
//         messageId: result.MessageId,
//       };
//     } catch (error) {
//       logger.error('SES error:', error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown SES error',
//       };
//     }
//   }
// }

// export class EmailProviderService {
//   private providers: EmailProvider[] = [
//     new SendGridProvider(),
//     new MailgunProvider(),
//     new SESProvider(),
//   ];
  
//   private currentProviderIndex = 0;
  
//   /**
//    * Send email with failover between providers
//    */
//   async sendEmail(data: EmailData): Promise<EmailResult> {
//     let lastError: string | undefined;
    
//     // Try each provider in order
//     for (let i = 0; i < this.providers.length; i++) {
//       const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
//       const provider = this.providers[providerIndex];
      
//       try {
//         logger.info(`Attempting to send email using ${provider.name}`);
//         const result = await provider.sendEmail(data);
        
//         if (result.success) {
//           logger.info(`Email sent successfully using ${provider.name}`);
//           // Update current provider for next time
//           this.currentProviderIndex = providerIndex;
//           return result;
//         }
        
//         lastError = result.error;
//         logger.warn(`${provider.name} failed: ${result.error}`);
//       } catch (error) {
//         lastError = error instanceof Error ? error.message : 'Unknown error';
//         logger.error(`${provider.name} error:`, error);
//       }
//     }
    
//     // All providers failed
//     return {
//       success: false,
//       error: lastError || 'All email providers failed',
//     };
//   }
  
//   /**
//    * Get current provider
//    */
//   getCurrentProvider(): EmailProvider {
//     return this.providers[this.currentProviderIndex];
//   }
  
//   /**
//    * Set current provider
//    */
//   setCurrentProvider(index: number): void {
//     if (index >= 0 && index < this.providers.length) {
//       this.currentProviderIndex = index;
//     }
//   }
// }












// services/emailProvider.services.ts
import { EmailMessage, EmailProviderConfig } from '../providers/email.types';
import { EmailProviderFactory, IEmailProvider } from '../providers/email.factory';
import { logger } from '../utils/logger';

export interface EmailData {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

export class EmailProviderService {
  private providers: Map<string, IEmailProvider> = new Map();
  private defaultProvider: string = 'nodemailer';

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    try {
      // Nodemailer configuration
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const nodemailerConfig: EmailProviderConfig = {
          name: 'nodemailer',
          transport: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          },
          defaultFrom: process.env.DEFAULT_FROM_EMAIL,
        };

        const nodemailerProvider = EmailProviderFactory.createProvider(nodemailerConfig);
        this.providers.set('nodemailer', nodemailerProvider);
        logger.info('Nodemailer provider initialized');
      }

      // Resend configuration
      if (process.env.RESEND_API_KEY) {
        const resendConfig: EmailProviderConfig = {
          name: 'resend',
          apiKey: process.env.RESEND_API_KEY,
          defaultFrom: process.env.DEFAULT_RESEND_FROM_EMAIL,
        };

        const resendProvider = EmailProviderFactory.createProvider(resendConfig);
        this.providers.set('resend', resendProvider);
        this.defaultProvider = 'resend';
        logger.info('Resend provider initialized');
      }

      // Mailtrap configuration
      if (process.env.MAILTRAP_API_KEY) {
        const mailtrapConfig: EmailProviderConfig = {
          name: 'mailtrap',
          apiKey: process.env.MAILTRAP_API_KEY,
          defaultFrom: process.env.DEFAULT_MAILTRAP_FROM_EMAIL,
        };

        const mailtrapProvider = EmailProviderFactory.createProvider(mailtrapConfig);
        this.providers.set('mailtrap', mailtrapProvider);
        logger.info('Mailtrap provider initialized');
      }

      if (this.providers.size === 0) {
        logger.warn('No email providers were initialized. Check your environment variables.');
      }

    } catch (error) {
      logger.error('Failed to initialize email providers:', error);
    }
  }

  async sendEmail(emailData: EmailData, providerName?: string): Promise<EmailResult> {
    try {
      const provider = providerName ? 
        this.providers.get(providerName) : 
        this.providers.get(this.defaultProvider);

      if (!provider) {
        throw new Error('No email provider available');
      }

      const emailMessage: EmailMessage = {
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        cc: emailData.cc,
        bcc: emailData.bcc,
        replyTo: emailData.replyTo,
        attachments: emailData.attachments,
      };

      const result = await provider.send(emailMessage);
      
      return {
        success: true,
        messageId: result.messageId || result.id,
        provider: providerName || this.defaultProvider,
      };
    } catch (error) {
      logger.error('Email sending failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: providerName || this.defaultProvider,
      };
    }
  }

  async sendBulkEmails(emails: EmailData[], providerName?: string): Promise<EmailResult[]> {
    try {
      const provider = providerName ? 
        this.providers.get(providerName) : 
        this.providers.get(this.defaultProvider);

      if (!provider) {
        throw new Error('No email provider available');
      }

      const emailMessages: EmailMessage[] = emails.map(emailData => ({
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        cc: emailData.cc,
        bcc: emailData.bcc,
        replyTo: emailData.replyTo,
        attachments: emailData.attachments,
      }));

      const results = await provider.sendBulk(emailMessages);
      
      return results.map((result: any) => ({
        success: result.success,
        messageId: result.messageId || result.result?.messageId,
        provider: providerName || this.defaultProvider,
        error: result.error,
      }));
    } catch (error) {
      logger.error('Bulk email sending failed:', error);
      return emails.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: providerName || this.defaultProvider,
      }));
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }
 
  async validateProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) return false;
    
    return await provider.validate();
  }
}