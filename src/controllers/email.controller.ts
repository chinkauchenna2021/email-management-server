import { Request, Response } from 'express';
import { EmailService } from '../services/email.services';
import { EmailValidationService } from '../services/emailValidation.services';
import { logger } from '../utils/logger';

export class EmailController {
  /**
   * Create a new email list
   */
  static async createEmailList(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'List name is required' });
      }
      
      const emailList = await EmailService.createEmailList(userId, name);
      
      res.status(201).json({
        message: 'Email list created successfully',
        emailList,
      });
    } catch (error) {
      logger.error('Create email list error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get user email lists
   */
  static async getUserEmailLists(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const emailLists = await EmailService.getUserEmailLists(userId);
      
      res.json({ emailLists });
    } catch (error) {
      logger.error('Get user email lists error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Add emails to a list
   */
  static async addEmailsToList(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { listId } = req.params;
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: 'Emails array is required' });
      }
      
      const result = await EmailService.addEmailsToList(userId, listId, emails);
      
      res.json(result);
    } catch (error) {
      logger.error('Add emails to list error:', error);
      
      if (error instanceof Error && error.message === 'Email list not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get emails in a list
   */
  static async getEmailsInList(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { listId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await EmailService.getEmailsInList(userId, listId, page, limit);
      
      res.json(result);
    } catch (error) {
      logger.error('Get emails in list error:', error);
      
      if (error instanceof Error && error.message === 'Email list not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Delete an email list
   */
  static async deleteEmailList(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { listId } = req.params;
      
      const result = await EmailService.deleteEmailList(userId, listId);
      
      res.json(result);
    } catch (error) {
      logger.error('Delete email list error:', error);
      
      if (error instanceof Error && error.message === 'Email list not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Validate a batch of emails
   */
  static async validateEmailBatch(req: Request, res: Response) {
    try {
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: 'Emails array is required' });
      }
      
      const result = await EmailValidationService.validateEmailBatch(emails);
      
      res.json(result);
    } catch (error) {
      logger.error('Validate email batch error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}