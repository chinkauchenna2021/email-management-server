// services/email.factory.ts
import { EmailProviderConfig, EmailMessage } from '../types/email.types';
import { NodemailerProvider } from './NodemailerProvider';
import { ResendProvider } from './ResendProvider';
import { MailtrapProvider } from './MailtrapProvider';

export interface IEmailProvider {
  send(email: EmailMessage): Promise<any>;
  sendBulk(emails: EmailMessage[]): Promise<any>;
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