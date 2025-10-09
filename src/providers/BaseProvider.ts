// services/email/providers/BaseProvider.ts
import { IEmailProvider, EmailMessage } from './email.factory';
import { EmailProviderConfig } from './email.types';

export abstract class BaseProvider implements IEmailProvider {
  protected config: EmailProviderConfig;

  constructor(config: EmailProviderConfig) {
    this.config = config;
  }

  abstract send(email: EmailMessage): Promise<any>;
  abstract sendBulk(emails: EmailMessage[]): Promise<any>;
  abstract validate(): Promise<boolean>;

  protected validateEmailMessage(email: EmailMessage): void {
    if (!email.to || (Array.isArray(email.to) && email.to.length === 0)) {
      throw new Error('Recipient email is required');
    }
    if (!email.subject) {
      throw new Error('Email subject is required');
    }
    if (!email.html && !email.text) {
      throw new Error('Email content (html or text) is required');
    }
  }

  protected getFromEmail(email: EmailMessage): string {
    return email.from || this.config.defaultFrom || 'noreply@example.com';
  }
}