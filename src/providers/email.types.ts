// types/email.types.ts
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
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface BulkEmailJob {
  id: string;
  campaignId: string;
  userId: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalEmails: number;
  processedEmails: number;
  successCount: number;
  failureCount: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTracking {
  id: string;
  email: string;
  jobId: string;
  messageId: string;
  provider: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  events?: EmailEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailEvent {
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  timestamp: Date;
  data?: any;
}