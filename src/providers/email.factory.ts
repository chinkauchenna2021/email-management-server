// services/email/providers/EmailProviderFactory.ts
import { EmailProviderConfig, EmailMessage as EmailServicesMessage } from './email.types';
import { NodemailerProvider } from './NodemailerProvider';
import { ResendProvider } from './ResendProvider';
import { MailtrapProvider } from './MailtrapProvider';

export interface IEmailProvider {
  send(email: EmailServicesMessage): Promise<any>;
  sendBulk(emails: EmailServicesMessage[]): Promise<any>;
  validate(): Promise<boolean>;
}



// services/email.factory.ts
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface IEmailProvider {
  send(email: EmailServicesMessage): Promise<any>;
  sendBulk(emails: EmailServicesMessage[]): Promise<any>;
  validate(): Promise<boolean>;
}


export class EmailProviderFactory {
  static createProvider(config: EmailProviderConfig): IEmailProvider {
    switch (config.name.toLowerCase()) {
      case 'nodemailer':
        return new NodemailerProvider(config);
      case 'resend':
        return new ResendProvider(config);
      case 'mailtrap':
        return new MailtrapProvider(config);
      default:
        throw new Error(`Unsupported email provider: ${config.name}`);
    }
  }
}