// providers/NodemailerProvider.ts
import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import { BaseProvider } from './BaseProvider';
import { EmailMessage, EmailProviderConfig } from '../types/email.types';

interface ConnectionMetrics {
  successCount: number;
  errorCount: number;
  lastError?: Date;
  coolingUntil?: Date;
}

export class NodemailerProvider extends BaseProvider {
  private transporter: Transporter;
  private connectionMetrics: ConnectionMetrics = {
    successCount: 0,
    errorCount: 0
  };
  private readonly MAX_RETRIES = 3;
  private readonly COOLING_PERIOD = 5 * 60 * 1000; // 5 minutes cooling

  constructor(config: EmailProviderConfig) {
    super(config);
    
    if (!config.transport) {
      throw new Error('Nodemailer transport configuration is required');
    }
    
    // Enhanced transport configuration with connection pooling and timeouts
    const enhancedTransport = {
      ...config.transport,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000, // 1 second between messages
      rateLimit: 10, // 10 messages per rateDelta
      socketTimeout: 30000, // 30 seconds
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    };

    this.transporter = nodemailer.createTransport(enhancedTransport);

    // Event listeners for connection monitoring
    this.transporter.on('idle', () => {
      console.log('Nodemailer connection pool is idle');
    });

    this.transporter.on('error', (error) => {
      console.error('Nodemailer connection error:', error);
      this.connectionMetrics.errorCount++;
      this.connectionMetrics.lastError = new Date();
    });
  }

  async send(email: EmailMessage): Promise<any> {
    this.validateEmailMessage(email);

    // Check if in cooling period
    if (this.connectionMetrics.coolingUntil && this.connectionMetrics.coolingUntil > new Date()) {
      throw new Error(`Provider in cooling period until ${this.connectionMetrics.coolingUntil}`);
    }

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
      headers: (email as any)?.headers || {}
    };

    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result: SentMessageInfo = await this.transporter.sendMail(mailOptions);
        
        this.connectionMetrics.successCount++;
        
        return {
          messageId: result.messageId,
          response: result.response,
          envelope: result.envelope,
          accepted: result.accepted,
          rejected: result.rejected,
          pending: result.pending
        };

      } catch (error:any) {
        lastError = error as Error;
        this.connectionMetrics.errorCount++;
        this.connectionMetrics.lastError = new Date();

        // If it's a connection timeout, implement cooling
        if (this.isConnectionError(error)) {
          if (attempt === this.MAX_RETRIES) {
            this.activateCoolingPeriod();
            throw new Error(`Failed after ${this.MAX_RETRIES} attempts: ${error.message}`);
          }
          
          // Exponential backoff
          const backoffTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Try to recreate transporter if it's a serious connection issue
          if (attempt === 2) {
            await this.recreateTransporter();
          }
        } else {
          // Non-connection error, don't retry
          throw error;
        }
      }
    }

    throw lastError!;
  }

  async sendBulk(emails: EmailMessage[]): Promise<any> {
    const results = [];
    const coolingThreshold = 10; // Activate cooling after 10 consecutive errors
    
    for (const email of emails) {
      try {
        // Check error rate before sending
        if (this.connectionMetrics.errorCount >= coolingThreshold && 
            this.connectionMetrics.successCount > 0) {
          const errorRate = this.connectionMetrics.errorCount / 
                           (this.connectionMetrics.successCount + this.connectionMetrics.errorCount);
          
          if (errorRate > 0.5) { // 50% error rate
            this.activateCoolingPeriod();
            throw new Error('High error rate detected, activating cooling period');
          }
        }

        const result = await this.send(email);
        results.push({ 
          success: true, 
          email: email.to, 
          result,
          messageId: result.messageId 
        });

        // Rate limiting between emails
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error:any) {
        results.push({ 
          success: false, 
          email: email.to, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });

        // Stop bulk sending if we hit cooling period
        if (error.message.includes('cooling period')) {
          break;
        }
      }
    }

    return results;
  }

  async validate(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.connectionMetrics.successCount++;
      return true;
    } catch (error) {
      this.connectionMetrics.errorCount++;
      this.connectionMetrics.lastError = new Date();
      console.error('Nodemailer validation failed:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'nodemailer';
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  resetMetrics(): void {
    this.connectionMetrics = {
      successCount: 0,
      errorCount: 0
    };
  }

  private isConnectionError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('timeout') ||
           errorMessage.includes('connection') ||
           errorMessage.includes('econn') ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ECONNREFUSED' ||
           error.code === 'ECONNRESET';
  }

  private activateCoolingPeriod(): void {
    this.connectionMetrics.coolingUntil = new Date(Date.now() + this.COOLING_PERIOD);
    console.warn(`Nodemailer cooling period activated until ${this.connectionMetrics.coolingUntil}`);
  }

  private async recreateTransporter(): Promise<void> {
    try {
      if (this.transporter) {
        this.transporter.close();
      }
      
      this.transporter = nodemailer.createTransport({
        ...this.config.transport,
        pool: true,
        maxConnections: 3, // Reduced for reconnection
        socketTimeout: 30000,
        connectionTimeout: 10000,
      });

      await this.transporter.verify();
      console.log('Nodemailer transporter recreated successfully');
    } catch (error) {
      console.error('Failed to recreate nodemailer transporter:', error);
      throw error;
    }
  }
}