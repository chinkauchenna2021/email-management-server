// services/email/providers/MailtrapProvider.ts
import { BaseProvider } from './BaseProvider';
import { EmailMessage, EmailProviderConfig } from './email.types';

export class MailtrapProvider extends BaseProvider {
  private apiKey: string;
  private baseUrl: string = 'https://send.api.mailtrap.io';

  constructor(config: EmailProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Mailtrap API key is required');
    }

    this.apiKey = config.apiKey;
  }

  async send(email: EmailMessage): Promise<any> {
    this.validateEmailMessage(email);

    const response = await fetch(`${this.baseUrl}/api/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: this.getFromEmail(email) },
        to: this.formatRecipients(email.to),
        subject: email.subject,
        html: email.html,
        text: email.text,
        cc: this.formatRecipients(email.cc),
        bcc: this.formatRecipients(email.bcc),
        attachments: email.attachments?.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? 
                   Buffer.from(att.content).toString('base64') : 
                   att.content.toString('base64'),
          type: att.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mailtrap API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result:any = await response.json();
    return {
      messageId: result.message_ids?.[0],
      ...result,
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
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return results;
  }

  async validate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/account`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Mailtrap validation failed:', error);
      return false;
    }
  }

  private formatRecipients(recipients?: string | string[]): { email: string }[] {
    if (!recipients) return [];
    
    const emails = Array.isArray(recipients) ? recipients : [recipients];
    return emails.map(email => ({ email }));
  }
}