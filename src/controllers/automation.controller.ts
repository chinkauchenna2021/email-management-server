import { Request, Response } from 'express';
import { AutomationService } from '../services/automations.services';
import { logger } from '../utils/logger';

export class AutomationController {
  /**
   * Create a new email automation
   */
  static async createAutomation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, description, trigger, conditions, actions } = req.body;
      
      if (!name || !trigger || !conditions || !actions) {
        return res.status(400).json({ 
          message: 'Name, trigger, conditions, and actions are required' 
        });
      }
      
      const automation = await AutomationService.createAutomation(
        userId,
        name,
        description,
        trigger,
        conditions,
        actions
      );
      
      res.status(201).json({
        message: 'Automation created successfully',
        automation,
      });
    } catch (error) {
      logger.error('Create automation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get user automations
   */
  static async getUserAutomations(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await AutomationService.getUserAutomations(userId, page, limit);
      
      res.json(result);
    } catch (error) {
      logger.error('Get user automations error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get a specific automation
   */
  static async getAutomation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { automationId } = req.params;
      
      const automation = await AutomationService.getAutomation(userId, automationId);
      
      res.json({ automation });
    } catch (error) {
      logger.error('Get automation error:', error);
      
      if (error instanceof Error && error.message === 'Automation not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Update an automation
   */
  static async updateAutomation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { automationId } = req.params;
      const { name, description, trigger, conditions, actions, isActive } = req.body;
      
      const automation = await AutomationService.updateAutomation(
        userId,
        automationId,
        name,
        description,
        trigger,
        conditions,
        actions,
        isActive
      );
      
      res.json({
        message: 'Automation updated successfully',
        automation,
      });
    } catch (error) {
      logger.error('Update automation error:', error);
      
      if (error instanceof Error && error.message === 'Automation not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Delete an automation
   */
  static async deleteAutomation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { automationId } = req.params;
      
      const result = await AutomationService.deleteAutomation(userId, automationId);
      
      res.json(result);
    } catch (error) {
      logger.error('Delete automation error:', error);
      
      if (error instanceof Error && error.message === 'Automation not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Toggle automation status
   */
  static async toggleAutomation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { automationId } = req.params;
      
      const result = await AutomationService.toggleAutomation(userId, automationId);
      
      res.json(result);
    } catch (error) {
      logger.error('Toggle automation error:', error);
      
      if (error instanceof Error && error.message === 'Automation not found') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}