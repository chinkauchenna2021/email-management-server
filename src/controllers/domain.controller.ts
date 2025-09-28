import { Request, Response } from 'express';
import { DomainService } from '../services/domain.services';
import { logger } from '../utils/logger';

export class DomainController {
  /**
   * Add a new domain with SMTP settings
   */
  static async addDomain(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { domain, smtpSettings } = req.body;
      
      if (!domain) {
        return res.status(400).json({ message: 'Domain is required' });
      }
      
      const result = await DomainService.addDomain(userId, domain, smtpSettings || {});
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Add domain error:', error);
      
      if (error instanceof Error && error.message === 'Domain already exists') {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Update domain SMTP settings
   */
  static async updateDomainSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { domainId } = req.params;
      const { smtpSettings } = req.body;
      
      if (!smtpSettings) {
        return res.status(400).json({ message: 'SMTP settings are required' });
      }
      
      const result = await DomainService.updateDomainSettings(userId, domainId, smtpSettings);
      
      res.json(result);
    } catch (error) {
      logger.error('Update domain settings error:', error);
      
      if (error instanceof Error && error.message === 'Domain not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get domain statistics
   */
  static async getDomainStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { domainId } = req.params;
      
      const stats = await DomainService.getDomainStats(userId, domainId);
      
      res.json(stats);
    } catch (error) {
      logger.error('Get domain stats error:', error);
      
      if (error instanceof Error && error.message === 'Domain not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get all domains with summary statistics
   */
  static async getAllDomainsWithStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const result = await DomainService.getAllDomainsWithStats(userId);
      
      res.json(result);
    } catch (error) {
      logger.error('Get all domains with stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Test SMTP settings
   */
  static async testSmtpSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { domainId } = req.params;
      
      const result = await DomainService.testSmtpSettings(userId, domainId);
      
      res.json(result);
    } catch (error) {
      logger.error('Test SMTP settings error:', error);
      
      if (error instanceof Error && error.message === 'Domain not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  // Keep existing methods (verifyDomain, getUserDomains, deleteDomain)

  
  /**
   * Verify DNS records for a domain
   */
  static async verifyDomain(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { domainId } = req.params;
      
      const result = await DomainService.verifyDomain(userId, domainId);
      
      res.json(result);
    } catch (error) {
      logger.error('Verify domain error:', error);
      
      if (error instanceof Error && error.message === 'Domain not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get user domains
   */
  static async getUserDomains(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const domains = await DomainService.getUserDomains(userId);
      
      res.json({ domains });
    } catch (error) {
      logger.error('Get user domains error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Delete a domain
   */
  static async deleteDomain(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { domainId } = req.params;
      
      const result = await DomainService.deleteDomain(userId, domainId);
      
      res.json(result);
    } catch (error) {
      logger.error('Delete domain error:', error);
      
      if (error instanceof Error && error.message === 'Domain not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}