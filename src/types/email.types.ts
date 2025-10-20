export interface EmailProviderConfig {
  name: string;
  apiKey?: string;
  transport?: any;
  defaultFrom?: string;
  baseUrl?: string;
  region?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  headers?:any;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailData {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}