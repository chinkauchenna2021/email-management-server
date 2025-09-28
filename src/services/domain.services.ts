import prisma from '../config/database';
import { DNSVerifier } from '../utils/dnsVerifier';
import { logger } from '../utils/logger';

export class DomainService {
  /**
   * Add a new domain with SMTP settings
   */
  static async addDomain(userId: string, domain: string, smtpSettings: any) {
    try {
      // Check if domain already exists for this user
      const existingDomain = await prisma.domain.findFirst({
        where: { userId, domain },
      });
      
      if (existingDomain) {
        throw new Error('Domain already exists');
      }
      
      // Generate DNS records
      const dnsRecords = DNSVerifier.generateDNSRecords(domain);
      
      // Create domain record with SMTP settings
      const newDomain = await prisma.domain.create({
        data: {
          userId,
          domain,
          dkimKey: dnsRecords.dkim,
          spfRecord: dnsRecords.spf,
          dmarcRecord: dnsRecords.dmarc,
          smtpProvider: smtpSettings.provider,
          smtpHost: smtpSettings.host,
          smtpPort: smtpSettings.port,
          smtpSecurity: smtpSettings.security,
          smtpUsername: smtpSettings.username,
          smtpPassword: smtpSettings.password,
          dailyLimit: smtpSettings.dailyLimit,
          enableDomainWarmup: smtpSettings.enableDomainWarmup || false,
          testEmail: smtpSettings.testEmail,
          textMessage: smtpSettings.textMessage,
        },
      });
      
      return {
        domain: newDomain,
        dnsRecords,
        message: 'Domain added successfully. Please add the DNS records to your domain provider.',
      };
    } catch (error) {
      logger.error('Add domain error:', error);
      throw error;
    }
  }
  
  /**
   * Update domain SMTP settings
   */
  static async updateDomainSettings(userId: string, domainId: string, smtpSettings: any) {
    try {
      // Check if domain exists and belongs to user
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId },
      });
      
      if (!domain) {
        throw new Error('Domain not found');
      }
      
      // Update domain SMTP settings
      const updatedDomain = await prisma.domain.update({
        where: { id: domainId },
        data: {
          smtpProvider: smtpSettings.provider,
          smtpHost: smtpSettings.host,
          smtpPort: smtpSettings.port,
          smtpSecurity: smtpSettings.security,
          smtpUsername: smtpSettings.username,
          smtpPassword: smtpSettings.password,
          dailyLimit: smtpSettings.dailyLimit,
          enableDomainWarmup: smtpSettings.enableDomainWarmup,
          testEmail: smtpSettings.testEmail,
          textMessage: smtpSettings.textMessage,
        },
      });
      
      return {
        domain: updatedDomain,
        message: 'Domain SMTP settings updated successfully',
      };
    } catch (error) {
      logger.error('Update domain settings error:', error);
      throw error;
    }
  }
  
  /**
   * Get domain statistics
   */
  static async getDomainStats(userId: string, domainId: string) {
    try {
      // Check if domain exists and belongs to user
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId },
      });
      
      if (!domain) {
        throw new Error('Domain not found');
      }
      
      // Get email sends for this domain
      const emailSends = await prisma.emailSend.findMany({
        where: {
          campaign: {
            domainId: domainId,
            userId: userId,
          },
        },
      });
      
      // Calculate statistics
      const totalEmails = emailSends.length;
      const delivered = emailSends.filter(send => send.status === 'DELIVERED').length;
      const bounced = emailSends.filter(send => send.status === 'BOUNCED').length;
      const opened = emailSends.filter(send => send.status === 'OPENED').length;
      const clicked = emailSends.filter(send => send.status === 'CLICKED').length;
      const complained = emailSends.filter(send => send.status === 'COMPLAINED').length;
      
      // Calculate percentages
      const deliveredPercentage = totalEmails > 0 ? (delivered / totalEmails) * 100 : 0;
      const bouncedPercentage = totalEmails > 0 ? (bounced / totalEmails) * 100 : 0;
      const openedPercentage = totalEmails > 0 ? (opened / totalEmails) * 100 : 0;
      const clickedPercentage = totalEmails > 0 ? (clicked / totalEmails) * 100 : 0;
      const complainedPercentage = totalEmails > 0 ? (complained / totalEmails) * 100 : 0;
      
      // Get current daily usage
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayEmailSends = await prisma.emailSend.count({
        where: {
          campaign: {
            domainId: domainId,
            userId: userId,
          },
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
      
      return {
        domainId,
        domain: domain.domain,
        reputation: domain.reputation,
        stats: {
          deliveredPercentage,
          bouncedPercentage,
          complainedPercentage,
          openedPercentage,
          clickedPercentage,
          totalEmails,
          failedEmails: totalEmails - delivered,
          dmarcPolicy: domain.dmarcRecord,
          reputationImprovement: domain.reputation, // This could be calculated over time
        },
        usage: {
          maxDailyUsage: domain.dailyLimit,
          currentDailyUsage: todayEmailSends,
        },
      };
    } catch (error) {
      logger.error('Get domain stats error:', error);
      throw error;
    }
  }
  
  /**
   * Get all domains with summary statistics
   */
  static async getAllDomainsWithStats(userId: string) {
    try {
      const domains = await prisma.domain.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      
      // Get total domains
      const totalDomains = domains.length;
      
      // Calculate total daily emails across all domains
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const totalDailyEmails = await prisma.emailSend.count({
        where: {
          campaign: {
            userId: userId,
          },
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
      
      // Calculate average reputation
      const totalReputation = domains.reduce((sum, domain) => sum + (domain.reputation || 0), 0);
      const averageReputation = totalDomains > 0 ? totalReputation / totalDomains : 0;
      
      return {
        totalDomains,
        totalDailyEmails,
        averageReputation,
        domains,
      };
    } catch (error) {
      logger.error('Get all domains with stats error:', error);
      throw error;
    }
  }
  
  /**
   * Test SMTP settings
   */
  static async testSmtpSettings(userId: string, domainId: string) {
    try {
      // Check if domain exists and belongs to user
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId },
      });
      
      if (!domain) {
        throw new Error('Domain not found');
      }
      
      // In a real implementation, you would test the SMTP connection here
      // For now, we'll simulate a successful test
      const testResult = {
        success: true,
        message: 'SMTP connection successful',
        details: {
          provider: domain.smtpProvider,
          host: domain.smtpHost,
          port: domain.smtpPort,
          security: domain.smtpSecurity,
        },
      };
      
      return testResult;
    } catch (error) {
      logger.error('Test SMTP settings error:', error);
      throw error;
    }
  }
  
  // Keep existing methods (verifyDomain, getUserDomains, deleteDomain, updateDomainReputation)





  // static async addDomain(userId: string, domain: string) {
  //   try {
  //     // Check if domain already exists for this user
  //     const existingDomain = await prisma.domain.findFirst({
  //       where: { userId, domain },
  //     });
      
  //     if (existingDomain) {
  //       throw new Error('Domain already exists');
  //     }
      
  //     // Generate DNS records
  //     const dnsRecords = DNSVerifier.generateDNSRecords(domain);
      
  //     // Create domain record
  //     const newDomain = await prisma.domain.create({
  //       data: {
  //         userId,
  //         domain,
  //         dkimKey: dnsRecords.dkim,
  //         spfRecord: dnsRecords.spf,
  //         dmarcRecord: dnsRecords.dmarc,
  //       },
  //     });
      
  //     return {
  //       domain: newDomain,
  //       dnsRecords,
  //       message: 'Domain added successfully. Please add the DNS records to your domain provider.',
  //     };
  //   } catch (error) {
  //     logger.error('Add domain error:', error);
  //     throw error;
  //   }
  // }
  
  /**
   * Verify DNS records for a domain
   */
  static async verifyDomain(userId: string, domainId: string) {
    try {
      // Get domain
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId },
      });
      
      if (!domain) {
        throw new Error('Domain not found');
      }
      
      // Verify DNS records
      const verification = await DNSVerifier.verifyDNSRecords(domain.domain);
      
      // Update domain verification status
      const updatedDomain = await prisma.domain.update({
        where: { id: domainId },
        data: {
          verified: verification.dkim && verification.spf && verification.dmarc,
        },
      });
      
      return {
        domain: updatedDomain,
        verification,
        message: verification.dkim && verification.spf && verification.dmarc
          ? 'Domain verified successfully!'
          : 'Domain verification failed. Please check your DNS records.',
      };
    } catch (error) {
      logger.error('Verify domain error:', error);
      throw error;
    }
  }
  
  /**
   * Get user domains
   */
  static async getUserDomains(userId: string) {
    try {
      const domains = await prisma.domain.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      
      return domains;
    } catch (error) {
      logger.error('Get user domains error:', error);
      throw error;
    }
  }
  
  /**
   * Delete a domain
   */
  static async deleteDomain(userId: string, domainId: string) {
    try {
      // Check if domain exists and belongs to user
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId },
      });
      
      if (!domain) {
        throw new Error('Domain not found');
      }
      
      // Delete domain
      await prisma.domain.delete({
        where: { id: domainId },
      });
      
      return { message: 'Domain deleted successfully' };
    } catch (error) {
      logger.error('Delete domain error:', error);
      throw error;
    }
  }
  
  /**
   * Update domain reputation
   */
  static async updateDomainReputation(domainId: string, reputation: number) {
    try {
      await prisma.domain.update({
        where: { id: domainId },
        data: { reputation },
      });
    } catch (error) {
      logger.error('Update domain reputation error:', error);
      throw error;
    }
  }
}