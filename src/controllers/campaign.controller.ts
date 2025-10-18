import { Request, Response } from 'express';
import { CampaignService } from '../services/campaign.services';
import { logger } from '../utils/logger';
import {prisma} from '../config/database';
import { CampaignScheduler } from '../services/campaignScheduler';

export class CampaignController {
  /**
   * Create a new campaign
   */
// Update the createCampaign method in CampaignController
// static async createCampaign(req: Request, res: Response): Promise<void | any> {
//   try {
//     const userId = (req as any).user.id;
//     const { 
//       name, 
//       subject, 
//       content, 
//       domainId, 
//       listId, 
//       templateId,
//       scheduledAt,
//       saveAsDraft = false 
//     } = req.body;
    
//     if (!name || !subject || !content || !domainId || !listId) {
//       return res.status(400).json({ 
//         message: 'Name, subject, content, domainId, and listId are required' 
//       });
//     }
    
//     const campaign = await CampaignService.createCampaign(
//       userId,
//       name,
//       subject,
//       content,
//       domainId,
//       listId,
//       templateId,
//       scheduledAt ? new Date(scheduledAt) : undefined,
//       saveAsDraft
//     );

//     // If scheduled for future, add to scheduler
//     if (scheduledAt && !saveAsDraft) {
//       const scheduler = CampaignScheduler.getInstance();
//       await scheduler.scheduleCampaign(campaign.id, new Date(scheduledAt));
//     }
    
//     res.status(201).json({
//       message: 'Campaign created successfully',
//       campaign,
//     });
//   } catch (error) {
//     logger.error('Create campaign error:', error);
    
//     if (error instanceof Error) {
//       if (error.message === 'Domain not found' || error.message === 'Email list not found' || error.message === 'Template not found') {
//         return res.status(404).json({ message: error.message });
//       }
//       if (error.message === 'Domain is not verified' || error.message === 'Domain must have SMTP configuration to send emails') {
//         return res.status(400).json({ message: error.message });
//       }
//     }
    
//     res.status(500).json({ message: 'Internal server error' });
//   }
// }

// In CampaignController - update createCampaign method
static async createCampaign(req: Request, res: Response): Promise<void | any> {
  try {
    const userId = (req as any).user.id;
    const { 
      name, 
      subject, 
      content, 
      domainId, 
      listId, 
      templateId,
      fromName, // Add fromName
      scheduledAt,
      saveAsDraft = false 
    } = req.body;
    
    // Only require subject, domainId, listId, and fromName
    if (!subject || !domainId || !listId || !fromName) {
      return res.status(400).json({ 
        message: 'Subject, domainId, listId, and fromName are required' 
      });
    }
    
    // Generate name from subject if not provided
    const campaignName = name || `Campaign: ${subject.substring(0, 50)}${subject.length > 50 ? '...' : ''}`;
    
    const campaign = await CampaignService.createCampaign(
      userId,
      campaignName,
      subject,
      content || '<p>Your email content here</p>',
      domainId,
      listId,
      fromName, // Pass fromName
      templateId,
      scheduledAt ? new Date(scheduledAt) : undefined,
      saveAsDraft
    );

    // If scheduled for future, add to scheduler
    if (scheduledAt && !saveAsDraft) {
      const scheduler = CampaignScheduler.getInstance();
      await scheduler.scheduleCampaign(campaign.id, new Date(scheduledAt));
    }
    
    res.status(201).json({
      message: 'Campaign created successfully',
      campaign,
    });
  } catch (error) {
    logger.error('Create campaign error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Domain not found' || error.message === 'Email list not found' || error.message === 'Template not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Domain is not verified' || error.message === 'Domain must have SMTP configuration to send emails') {
        return res.status(400).json({ message: error.message });
      }
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
}




// Add this method to your CampaignController class
static async deleteCampaign(req: Request, res: Response): Promise<void | any> {
  try {
    const userId = (req as any).user.id;
    const { campaignId } = req.params;
    
    // Check if campaign exists and belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Optional: Prevent deletion of campaigns that are currently sending
    if (campaign.status === 'SENDING') {
      return res.status(400).json({ 
        message: 'Cannot delete a campaign that is currently sending' 
      });
    }

    // Delete the campaign (this should cascade to related records if your DB is set up properly)
    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    // Also unschedule if it was scheduled
    const scheduler = CampaignScheduler.getInstance();
    scheduler.unscheduleCampaign(campaignId);

    res.json({ 
      message: 'Campaign deleted successfully' 
    });
  } catch (error) {
    logger.error('Delete campaign error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Record to delete does not exist')) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Update the updateCampaign method
static async updateCampaign(req: Request, res: Response): Promise<void | any> {
  try {
    const userId = (req as any).user.id;
    const { campaignId } = req.params;
    const { 
      name, 
      subject, 
      content, 
      domainId, 
      listId, 
      templateId,
      scheduledAt,
      saveAsDraft = false 
    } = req.body;
    
    const campaign = await CampaignService.updateCampaign(
      userId,
      campaignId,
      name,
      subject,
      content,
      domainId,
      listId,
      templateId,
      scheduledAt ? new Date(scheduledAt) : undefined,
      saveAsDraft
    );

    // Handle scheduling updates
    const scheduler = CampaignScheduler.getInstance();
    
    if (scheduledAt && !saveAsDraft) {
      // Reschedule the campaign
      await scheduler.scheduleCampaign(campaignId, new Date(scheduledAt));
    } else {
      // Unschedule if no longer scheduled
      scheduler.unscheduleCampaign(campaignId);
    }
    
    res.json({
      message: 'Campaign updated successfully',
      campaign,
    });
  } catch (error) {
    logger.error('Update campaign error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Campaign not found' || 
          error.message === 'Domain not found' || 
          error.message === 'Email list not found' ||
          error.message === 'Template not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Domain is not verified' || 
          error.message === 'Cannot update a campaign that has already been sent' ||
          error.message === 'Domain must have SMTP configuration to send emails') {
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
      const status = req.query.status as string;
      const domainId = req.query.domainId as string;
      const listId = req.query.listId as string;
      
      const result = await CampaignService.getFilteredCampaigns(
        userId, 
        page, 
        limit, 
        status, 
        domainId, 
        listId
      );
      
      res.json(result);
    } catch (error) {
      logger.error('Get user campaigns error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get overall campaign statistics
   */
  static async getOverallCampaignStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const stats = await CampaignService.getOverallCampaignStats(userId);
      
      res.json(stats);
    } catch (error) {
      logger.error('Get overall campaign stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  // Keep existing methods (getCampaignDetails, sendCampaign, getCampaignStats, retryFailedEmails)

  // static async createCampaign(req: Request, res: Response) {
  //   try {
  //     const userId = (req as any).user.id;
  //     const { name, subject, content, domainId, listId, scheduledAt } = req.body;
      
  //     if (!name || !subject || !content || !domainId || !listId) {
  //       return res.status(400).json({ 
  //         message: 'Name, subject, content, domainId, and listId are required' 
  //       });
  //     }
      
  //     const campaign = await CampaignService.createCampaign(
  //       userId,
  //       name,
  //       subject,
  //       content,
  //       domainId,
  //       listId,
  //       scheduledAt ? new Date(scheduledAt) : undefined
  //     );
      
  //     res.status(201).json({
  //       message: 'Campaign created successfully',
  //       campaign,
  //     });
  //   } catch (error) {
  //     logger.error('Create campaign error:', error);
      
  //     if (error instanceof Error) {
  //       if (error.message === 'Domain not found' || error.message === 'Email list not found') {
  //         return res.status(404).json({ message: error.message });
  //       }
  //       if (error.message === 'Domain is not verified') {
  //         return res.status(400).json({ message: error.message });
  //       }
  //     }
      
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // }
  
  /**
   * Get user campaigns
   */
  // static async getUserCampaigns(req: Request, res: Response) {
  //   try {
  //     const userId = (req as any).user.id;
  //     const page = parseInt(req.query.page as string) || 1;
  //     const limit = parseInt(req.query.limit as string) || 20;
      
  //     const result = await CampaignService.getUserCampaigns(userId, page, limit);
      
  //     res.json(result);
  //   } catch (error) {
  //     logger.error('Get user campaigns error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // }
  
  /**
   * Get campaign details
   */
  static async getCampaignDetails(req: Request, res: Response): Promise<void | any> {
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
  static async sendCampaign(req: Request, res: Response): Promise<void | any> {
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
  static async getCampaignStats(req: Request, res: Response): Promise<void | any> {
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
  static async retryFailedEmails(req: Request, res: Response): Promise<void | any> {
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


  // src/controllers/campaign.controller.ts

// Add this method to the CampaignController class
static async getRecentCampaigns(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 4;
    
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        sends: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Calculate metrics for each campaign
    const recentCampaigns = campaigns.map((campaign) => {
      const sent = campaign.sends.length;
      const opened = campaign.sends.filter((send: { status: string }) => send.status === 'OPENED').length;
      const clicked = campaign.sends.filter((send: { status: string }) => send.status === 'CLICKED').length;
      
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sent,
        opened,
        clicked,
        date: CampaignController.formatDate(campaign.createdAt instanceof Date ? campaign.createdAt.toISOString() : campaign.createdAt),
      };
    });

    res.json(recentCampaigns);
  } catch (error) {
    logger.error('Get recent campaigns error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Helper method to format date
private static formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    const diffInHoursRounded = Math.floor(diffInHours);
    return `${diffInHoursRounded} hour${diffInHoursRounded !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    return date.toLocaleDateString();
  }
}
}