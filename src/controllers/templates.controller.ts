import { Request, Response } from 'express';
import { TemplateService } from '../services/templates.services';
import { logger } from '../utils/logger';

export class TemplateController {
  /**
   * Create a new email template
   */
  static async createTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, subject, content, category } = req.body;
      
      if (!name || !subject || !content) {
        return res.status(400).json({ 
          message: 'Name, subject, and content are required' 
        });
      }
      
      const template = await TemplateService.createTemplate(
        userId,
        name,
        subject,
        content,
        category
      );
      
      res.status(201).json({
        message: 'Template created successfully',
        template,
      });
    } catch (error) {
      logger.error('Create template error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get user templates
   */
  static async getUserTemplates(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string;
      
      const result = await TemplateService.getUserTemplates(
        userId,
        page,
        limit,
        category
      );
      
      res.json(result);
    } catch (error) {
      logger.error('Get user templates error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get a specific template
   */
  static async getTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { templateId } = req.params;
      
      const template = await TemplateService.getTemplate(userId, templateId);
      
      res.json({ template });
    } catch (error) {
      logger.error('Get template error:', error);
      
      if (error instanceof Error && error.message === 'Template not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Update a template
   */
  static async updateTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { templateId } = req.params;
      const { name, subject, content, category } = req.body;
      
      const template = await TemplateService.updateTemplate(
        userId,
        templateId,
        name,
        subject,
        content,
        category
      );
      
      res.json({
        message: 'Template updated successfully',
        template,
      });
    } catch (error) {
      logger.error('Update template error:', error);
      
      if (error instanceof Error && error.message === 'Template not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Delete a template
   */
  static async deleteTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { templateId } = req.params;
      
      const result = await TemplateService.deleteTemplate(userId, templateId);
      
      res.json(result);
    } catch (error) {
      logger.error('Delete template error:', error);
      
      if (error instanceof Error && error.message === 'Template not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get template categories
   */
  static async getTemplateCategories(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const result = await TemplateService.getTemplateCategories(userId);
      
      res.json(result);
    } catch (error) {
      logger.error('Get template categories error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Use a template
   */
  static async useTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { templateId } = req.params;
      
      const result = await TemplateService.useTemplate(userId, templateId);
      
      res.json(result);
    } catch (error) {
      logger.error('Use template error:', error);
      
      if (error instanceof Error && error.message === 'Template not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}