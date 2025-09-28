import { Request, Response } from 'express';
import { SettingsService } from '../services/settings.services';
import { logger } from '../utils/logger';

export class SettingsController {
  /**
   * Get user settings
   */
  static async getUserSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const settings = await SettingsService.getUserSettings(userId);
      
      res.json({ settings });
    } catch (error) {
      logger.error('Get user settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Update user settings
   */
  static async updateUserSettings(req: Request, res: Response): Promise<void | any> {
    try {
      const userId = (req as any).user.id;
      const { settings } = req.body;
      
      if (!settings) {
        return res.status(400).json({ message: 'Settings are required' });
      }
      
      const updatedSettings = await SettingsService.updateUserSettings(userId, settings);
      
      res.json({
        message: 'Settings updated successfully',
        settings: updatedSettings,
      });
    } catch (error) {
      logger.error('Update user settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  /**
   * Get app settings
   */
  static async getAppSettings(req: Request, res: Response) {
    try {
      const settings = await SettingsService.getAppSettings();
      
      res.json({ settings });
    } catch (error) {
      logger.error('Get app settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}