import {prisma} from '../config/database';
import { logger } from '../utils/logger';

export class SettingsService {
  /**
   * Get user settings
   */
  static async getUserSettings(userId: string) {
    try {
      let settings = await prisma.userSetting.findUnique({
        where: { userId },
      });
      
      // If settings don't exist, create default settings
      if (!settings) {
        settings = await prisma.userSetting.create({
          data: {
            userId,
            settings: {
              notifications: {
                email: true,
                browser: true,
              },
              emailDefaults: {
                fromName: '',
                replyTo: '',
              },
              security: {
                twoFactorAuth: false,
              },
              appearance: {
                theme: 'light',
                language: 'en',
              },
            },
          },
        });
      }
      
      return settings;
    } catch (error) {
      logger.error('Get user settings error:', error);
      throw error;
    }
  }
  
  /**
   * Update user settings
   */
  static async updateUserSettings(userId: string, settings: any) {
    try {
      // Check if settings exist for user
      let userSettings = await prisma.userSetting.findUnique({
        where: { userId },
      });
      
      if (userSettings) {
        // Update existing settings
        userSettings = await prisma.userSetting.update({
          where: { userId },
          data: {
            settings: {
              ...((typeof userSettings.settings === 'object' && userSettings.settings !== null) ? userSettings.settings : {}),
              ...settings,
            },
          },
        });
      } else {
        // Create new settings
        userSettings = await prisma.userSetting.create({
          data: {
            userId,
            settings,
          },
        });
      }
      
      return userSettings;
    } catch (error) {
      logger.error('Update user settings error:', error);
      throw error;
    }
  }
  
  /**
   * Get app settings
   */
  static async getAppSettings() {
    try {
      // In a real app, this might be stored in a database or environment variables
      // For now, we'll return some default settings
      return {
        app: {
          name: 'Email Management System',
          version: '1.0.0',
          description: 'Advanced email management and campaign system',
        },
        features: {
          maxEmailLists: 100,
          maxDomains: 10,
          maxTemplates: 50,
          maxAutomations: 20,
          maxRecipientsPerCampaign: 10000,
          maxDailyEmails: 50000,
        },
        smtp: {
          providers: ['SendGrid', 'Mailgun', 'SES', 'Custom SMTP'],
          defaultSecurity: 'TLS',
        },
        security: {
          passwordMinLength: 8,
          requireSpecialChars: true,
          sessionTimeout: 3600, // 1 hour in seconds
        },
      };
    } catch (error) {
      logger.error('Get app settings error:', error);
      throw error;
    }
  }
}