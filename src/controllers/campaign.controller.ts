import { Request, Response } from 'express';
import { CampaignService } from '../services/campaign.services';
import { logger } from '../utils/logger';

export class CampaignController {
  /**
   * Create a new campaign
   */
  static async createCampaign(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, subject, content, domainId, listId, scheduledAt } = req.body;
      
      if (!name || !subject || !content || !domainId || !listId) {
        return res.status(400).json({ 
          message: 'Name, subject, content, domainId, and listId are required' 
        });
      }
      
      const campaign = await CampaignService.createCampaign(
        userId,
        name,
        subject,
        content,
        domainId,
        listId,
        scheduledAt ? new Date(scheduledAt) : undefined
      );
      
      res.status(201).json({
        message: 'Campaign created successfully',
        campaign,
      });
    } catch (error) {
      logger.error('Create campaign error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Domain not found' || error.message === 'Email list not found') {
          return res.status(404).json({ message: error.message });
        }
        if (error.message === 'Domain is not verified') {
          return res.status(400).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get user campaigns
   */
  static async getUserCampaigns(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await CampaignService.getUserCampaigns(userId, page, limit);
      
      res.json(result);
    } catch (error) {
      logger.error('Get user campaigns error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get campaign details
   */
  static async getCampaignDetails(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { campaignId } = req.params;
      
      const campaign = await CampaignService.getCampaignDetails(userId, campaignId);
      
      res.json({ campaign });
    } catch (error) {
      logger.error('Get campaign details error:', error);
      
      if (error instanceof Error && error.message === 'Campaign not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Send a campaign
   */
  static async sendCampaign(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { campaignId } = req.params;
      
      const result = await CampaignService.sendCampaign(userId, campaignId);
      
      res.json(result);
    } catch (error) {
      logger.error('Send campaign error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Campaign not found') {
          return res.status(404).json({ message: error.message });
        }
        if (error.message === 'Domain is not verified') {
          return res.status(400).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get campaign statistics
   */
  static async getCampaignStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { campaignId } = req.params;
      
      const stats = await CampaignService.getCampaignStats(userId, campaignId);
      
      res.json(stats);
    } catch (error) {
      logger.error('Get campaign stats error:', error);
      
      if (error instanceof Error && error.message === 'Campaign not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Retry failed emails in a campaign
   */
  static async retryFailedEmails(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { campaignId } = req.params;
      
      const result = await CampaignService.retryFailedEmails(userId, campaignId);
      
      res.json(result);
    } catch (error) {
      logger.error('Retry failed emails error:', error);
      
      if (error instanceof Error && error.message === 'Campaign not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}