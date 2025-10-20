// providers/ResendProvider.ts
import { BaseProvider } from './BaseProvider';
import { EmailMessage, EmailProviderConfig } from '../types/email.types';

export class ResendProvider extends BaseProvider {
  private resend: any;

  constructor(config: EmailProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Resend API key is required');
    }

    // Dynamic import for Resend
    const { Resend } = require('resend');
    this.resend = new Resend(config.apiKey);
  }

  async send(email: EmailMessage): Promise<any> {
    this.validateEmailMessage(email);

    // CRITICAL FIX: Ensure subject is properly set and not overridden
    const emailData: any = {
      from: this.getFromEmail(email),
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject, // Explicitly set subject from email object
      html: email.html,
      text: email.text,
      cc: email.cc,
      bcc: email.bcc,
      reply_to: email.replyTo,
    };

    // Handle attachments if present
    if (email.attachments && email.attachments.length > 0) {
      emailData.attachments = email.attachments.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? 
                 Buffer.from(att.content).toString('base64') : 
                 att.content.toString('base64'),
        content_type: att.contentType,
      }));
    }

    const result = await this.resend.emails.send(emailData);

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    return {
      id: result.data?.id,
      messageId: result.data?.id,
    };
  }

  async sendBulk(emails: EmailMessage[]): Promise<any> {
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => 
        this.send(email).then(result => ({
          success: true,
          email: email.to,
          result,
          messageId: result.messageId
        })).catch(error => ({
          success: false,
          email: email.to,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : {
        success: false,
        email: 'unknown',
        error: 'Promise rejected'
      }));

      // Rate limiting delay
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async validate(): Promise<boolean> {
    try {
      // Test with a simple validation request
      const testResult = await this.resend.emails.send({
        from: this.config.defaultFrom || 'system@example.com',
        to: 'test@example.com',
        subject: 'Provider Validation Test',
        html: '<p>This is a validation test email</p>',
      });

      return !testResult.error;
    } catch (error) {
      console.error('Resend validation failed:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'resend';
  }
}