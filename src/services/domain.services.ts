import prisma from '../config/database';
import { DNSVerifier } from '../utils/dnsVerifier';
import { logger } from '../utils/logger';

export class DomainService {
  /**
   * Add a new domain
   */
  static async addDomain(userId: string, domain: string) {
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
      
      // Create domain record
      const newDomain = await prisma.domain.create({
        data: {
          userId,
          domain,
          dkimKey: dnsRecords.dkim,
          spfRecord: dnsRecords.spf,
          dmarcRecord: dnsRecords.dmarc,
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