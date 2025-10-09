// services/email/providers/NodemailerProvider.ts
import nodemailer, { Transporter } from 'nodemailer';
import { BaseProvider } from './BaseProvider';
import { EmailMessage, EmailProviderConfig } from './email.types';

export class NodemailerProvider extends BaseProvider {
  private transporter: Transporter;

  constructor(config: EmailProviderConfig) {
    super(config);
    
    if (!config.transport) {
      throw new Error('Nodemailer transport configuration is required');
    }
    
    this.transporter = nodemailer.createTransport(config.transport);
  }

  async send(email: EmailMessage): Promise<any> {
    this.validateEmailMessage(email);

    const mailOptions = {
      from: this.getFromEmail(email),
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo,
      attachments: email.attachments,
    };

    const result = await this.transporter.sendMail(mailOptions);
    return {
      messageId: result.messageId,
      response: result.response,
      envelope: result.envelope,
    };
  }

  async sendBulk(emails: EmailMessage[]): Promise<any> {
    const results = [];
    for (const email of emails) {
      try {
        const result = await this.send(email);
        results.push({ 
          success: true, 
          email: email.to, 
          result,
          messageId: result.messageId 
        });
      } catch (error) {
        results.push({ 
          success: false, 
          email: email.to, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    return results;
  }

  async validate(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Nodemailer validation failed:', error);
      return false;
    }
  }
}