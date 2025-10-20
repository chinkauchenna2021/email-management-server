import { BaseProvider } from './BaseProvider';
import { EmailMessage, EmailProviderConfig } from './email.types';
import {Resend} from 'resend'

export class ResendProvider extends BaseProvider {
  private resend:any;

  constructor(config: EmailProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Resend API key is required');
    }

    // Dynamic import for Resend
    this.resend = new Resend(config.apiKey);
  }

  async send(email: EmailMessage): Promise<any> {
    this.validateEmailMessage(email);

    const result = await this.resend.emails.send({
      from: this.getFromEmail(email),
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      cc: email.cc,
      bcc: email.bcc,
      reply_to: email.replyTo,
      attachments: email.attachments,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return {
      id: result.data?.id,
      messageId: result.data?.id,
    };
  }

  async sendBulk(emails: EmailMessage[]): Promise<any> {
    const batchSize = 100; // Resend recommended batch size
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
      // Try to get account info or send a test email
      await this.resend.emails.send({
        from: this.config.defaultFrom || 'test@example.com',
        to: 'test@example.com',
        subject: 'Validation Test',
        html: '<p>Test</p>',
      });
      return true;
    } catch (error) {
      console.error('Resend validation failed:', error);
      return false;
    }
  }
}