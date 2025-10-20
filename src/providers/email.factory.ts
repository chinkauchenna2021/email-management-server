// providers/email.factory.ts
import { EmailProviderConfig, EmailMessage } from '../types/email.types';
import { NodemailerProvider } from './NodemailerProvider';
import { ResendProvider } from './ResendProvider';
import { MailtrapProvider } from './MailtrapProvider';

export interface IEmailProvider {
  send(email: EmailMessage): Promise<any>;
  sendBulk(emails: EmailMessage[]): Promise<any>;
  validate(): Promise<boolean>;
  getProviderName(): string ;
}

export class EmailProviderFactory {
  private static providerCache = new Map<string, IEmailProvider>();
  private static validationCache = new Map<string, { isValid: boolean; lastValidated: Date }>();

  static createProvider(config: EmailProviderConfig): IEmailProvider {
    const cacheKey = this.getCacheKey(config);
    
    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }

    let provider: IEmailProvider | any;

    switch (config.name.toLowerCase()) {
      case 'nodemailer':
        provider = new NodemailerProvider(config);
        break;
      case 'resend':
        provider = new ResendProvider(config);
        break;
      case 'mailtrap':
        provider = new MailtrapProvider(config);
        break;
      default:
        throw new Error(`Unsupported email provider: ${config.name}`);
    }

    this.providerCache.set(cacheKey, provider);
    return provider;
  }

  static async validateProvider(config: EmailProviderConfig): Promise<boolean> {
    const cacheKey = this.getCacheKey(config);
    const cached = this.validationCache.get(cacheKey);
    
    // Cache validation for 5 minutes
    if (cached && Date.now() - cached.lastValidated.getTime() < 5 * 60 * 1000) {
      return cached.isValid;
    }

    try {
      const provider = this.createProvider(config);
      const isValid = await provider.validate();
      
      this.validationCache.set(cacheKey, {
        isValid,
        lastValidated: new Date()
      });

      return isValid;
    } catch (error) {
      this.validationCache.set(cacheKey, {
        isValid: false,
        lastValidated: new Date()
      });
      return false;
    }
  }

  static clearCache(config?: EmailProviderConfig) {
    if (config) {
      const cacheKey = this.getCacheKey(config);
      this.providerCache.delete(cacheKey);
      this.validationCache.delete(cacheKey);
    } else {
      this.providerCache.clear();
      this.validationCache.clear();
    }
  }

  private static getCacheKey(config: EmailProviderConfig): string {
    if (config.name.toLowerCase() === 'nodemailer' && config.transport) {
      return `nodemailer_${config.transport.host}_${config.transport.port}`;
    }
    return `${config.name}_${config.apiKey?.substring(0, 8)}`;
  }
}