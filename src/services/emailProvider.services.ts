import * as sgMail from '@sendgrid/mail';
import * as mailgun from 'mailgun-js';
import AWS from 'aws-sdk';
import { logger } from '../utils/logger';

// Initialize email providers
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
const mg = mailgun.default({
  apiKey: process.env.MAILGUN_API_KEY!,
  domain: process.env.MAILGUN_DOMAIN!,
});
const ses = new AWS.SES({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

export interface EmailProvider {
  name: string;
  sendEmail: (data: EmailData) => Promise<EmailResult>;
}

export interface EmailData {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class SendGridProvider implements EmailProvider {
  name = 'SendGrid';
  
  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      const msg = {
        to: data.to,
        from: data.from,
        subject: data.subject,
        text: data.text,
        html: data.html,
      };
      
      const result = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: result[0].headers['x-message-id'],
      };
    } catch (error) {
      logger.error('SendGrid error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SendGrid error',
      };
    }
  }
}

class MailgunProvider implements EmailProvider {
  name = 'Mailgun';
  
  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      const result = await mg.messages().send({
        to: data.to,
        from: data.from,
        subject: data.subject,
        text: data.text,
        html: data.html,
      });
      
      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      logger.error('Mailgun error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Mailgun error',
      };
    }
  }
}

class SESProvider implements EmailProvider {
  name = 'SES';
  
  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      const params = {
        Destination: {
          ToAddresses: [data.to],
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: data.html,
            },
            ...(data.text && {
              Text: {
                Charset: 'UTF-8',
                Data: data.text,
              },
            }),
          },
          Subject: {
            Charset: 'UTF-8',
            Data: data.subject,
          },
        },
        Source: data.from,
      };
      
      const result = await ses.sendEmail(params).promise();
      
      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error) {
      logger.error('SES error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SES error',
      };
    }
  }
}

export class EmailProviderService {
  private providers: EmailProvider[] = [
    new SendGridProvider(),
    new MailgunProvider(),
    new SESProvider(),
  ];
  
  private currentProviderIndex = 0;
  
  /**
   * Send email with failover between providers
   */
  async sendEmail(data: EmailData): Promise<EmailResult> {
    let lastError: string | undefined;
    
    // Try each provider in order
    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];
      
      try {
        logger.info(`Attempting to send email using ${provider.name}`);
        const result = await provider.sendEmail(data);
        
        if (result.success) {
          logger.info(`Email sent successfully using ${provider.name}`);
          // Update current provider for next time
          this.currentProviderIndex = providerIndex;
          return result;
        }
        
        lastError = result.error;
        logger.warn(`${provider.name} failed: ${result.error}`);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`${provider.name} error:`, error);
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: lastError || 'All email providers failed',
    };
  }
  
  /**
   * Get current provider
   */
  getCurrentProvider(): EmailProvider {
    return this.providers[this.currentProviderIndex];
  }
  
  /**
   * Set current provider
   */
  setCurrentProvider(index: number): void {
    if (index >= 0 && index < this.providers.length) {
      this.currentProviderIndex = index;
    }
  }
}