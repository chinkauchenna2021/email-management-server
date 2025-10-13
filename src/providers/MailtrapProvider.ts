// services/email/providers/MailtrapProvider.ts
import { BaseProvider } from './BaseProvider';
import { EmailMessage, EmailProviderConfig } from './email.types';
import { MailtrapClient, SendResponse } from "mailtrap";

export class MailtrapProvider extends BaseProvider {
  private client: MailtrapClient;
  private senderEmail: string;

  constructor(config: EmailProviderConfig & { senderEmail?: string }) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Mailtrap API key is required');
    }

    // Use provided senderEmail or fall back to defaultFrom from base config
    this.senderEmail = config.senderEmail || this.config.defaultFrom || 'noreply@example.com';

    this.client = new MailtrapClient({ 
      token: config.apiKey,
      bulk: (config as any).bulk || false 
    });
  }

  async send(email: EmailMessage): Promise<any> {
    this.validateEmailMessage(email);

    try {
      const response: SendResponse = await this.client.send({
        from: { 
          name: email.from || email.subject, 
          email: this.getFromEmail(email) // Using the protected method from BaseProvider
        },
        to: this.formatRecipients(email.to),
        subject: email.subject,
        text: email.text,
        html: email.html,
        cc: this.formatRecipients(email.cc),
        bcc: this.formatRecipients(email.bcc),
        attachments: email.attachments?.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? 
                   Buffer.from(att.content).toString('base64') : 
                   att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        })),
      });

      return {
        messageId: response.message_ids?.[0],
        success: true,
        response: response,
      };
    } catch (error) {
      console.error('Mailtrap send error:', error);
      throw new Error(`Mailtrap send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50000));
    }
    
    return results;
  }

  async validate(): Promise<boolean> {
    try {
      // Test the connection by attempting to send a simple validation request
      await this.client.send({
        from: { email: this.senderEmail, name: "Validation Test" },
        to: [{ email: "test@example.com" }],
        subject: "Validation Test",
        text: "This is a validation test",
        html: "<p>This is a validation test</p>",
      }).catch((error: { message: string | string[]; status: number; }) => {
        // If it's an authorization error, validation fails
        if (error.message?.includes('Unauthorized') || error.status === 401) {
          throw new Error('Invalid API key');
        }
        // Other errors might be due to sender configuration, but API key is valid
      });
      
      return true;
    } catch (error) {
      console.error('Mailtrap validation failed:', error);
      return false;
    }
  }

  // Private helper method for MailtrapProvider only
  private formatRecipients(recipients?: string | string[]): { email: string }[] {
    if (!recipients) return [];
    
    const emails = Array.isArray(recipients) ? recipients : [recipients];
    return emails.map(email => ({ email }));
  }
}