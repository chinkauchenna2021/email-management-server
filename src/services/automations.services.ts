import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Queue } from 'bullmq';
import redisClient from '../config/redis';

// Create automation queue
export const automationQueue = new Queue('automationQueue', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
});

export class AutomationService {
  /**
   * Create a new email automation
   */
  static async createAutomation(
    userId: string,
    name: string,
    description: string,
    trigger: string,
    conditions: any,
    actions: any[]
  ) {
    try {
      const automation = await prisma.automation.create({
        data: {
          userId,
          name,
          description,
          trigger,
          conditions,
          actions,
        },
      });
      
      // If automation is active, schedule it
      if (automation.isActive) {
        await this.scheduleAutomation(automation.id);
      }
      
      return automation;
    } catch (error) {
      logger.error('Create automation error:', error);
      throw error;
    }
  }
  
  /**
   * Get all automations for a user
   */
  static async getUserAutomations(userId: string, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const [automations, totalCount] = await Promise.all([
        prisma.automation.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.automation.count({
          where: { userId },
        }),
      ]);
      
      return {
        automations,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get user automations error:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific automation
   */
  static async getAutomation(userId: string, automationId: string) {
    try {
      const automation = await prisma.automation.findFirst({
        where: { id: automationId, userId },
      });
      
      if (!automation) {
        throw new Error('Automation not found');
      }
      
      return automation;
    } catch (error) {
      logger.error('Get automation error:', error);
      throw error;
    }
  }
  
  /**
   * Update an automation
   */
  static async updateAutomation(
    userId: string,
    automationId: string,
    name?: string,
    description?: string,
    trigger?: string,
    conditions?: any,
    actions?: any[],
    isActive?: boolean
  ) {
    try {
      // Check if automation exists and belongs to user
      const automation = await prisma.automation.findFirst({
        where: { id: automationId, userId },
      });
      
      if (!automation) {
        throw new Error('Automation not found');
      }
      
      // Update automation
      const updatedAutomation = await prisma.automation.update({
        where: { id: automationId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(trigger && { trigger }),
          ...(conditions && { conditions }),
          ...(actions && { actions }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      
      // If automation is active, schedule it
      if (updatedAutomation.isActive) {
        await this.scheduleAutomation(updatedAutomation.id);
      }
      
      return updatedAutomation;
    } catch (error) {
      logger.error('Update automation error:', error);
      throw error;
    }
  }
  
  /**
   * Delete an automation
   */
  static async deleteAutomation(userId: string, automationId: string) {
    try {
      // Check if automation exists and belongs to user
      const automation = await prisma.automation.findFirst({
        where: { id: automationId, userId },
      });
      
      if (!automation) {
        throw new Error('Automation not found');
      }
      
      // Delete automation
      await prisma.automation.delete({
        where: { id: automationId },
      });
      
      return { message: 'Automation deleted successfully' };
    } catch (error) {
      logger.error('Delete automation error:', error);
      throw error;
    }
  }
  
  /**
   * Toggle automation status
   */
  static async toggleAutomation(userId: string, automationId: string) {
    try {
      // Check if automation exists and belongs to user
      const automation = await prisma.automation.findFirst({
        where: { id: automationId, userId },
      });
      
      if (!automation) {
        throw new Error('Automation not found');
      }
      
      // Toggle automation status
      const updatedAutomation = await prisma.automation.update({
        where: { id: automationId },
        data: {
          isActive: !automation.isActive,
        },
      });
      
      // If automation is now active, schedule it
      if (updatedAutomation.isActive) {
        await this.scheduleAutomation(updatedAutomation.id);
      }
      
      return {
        message: `Automation ${updatedAutomation.isActive ? 'activated' : 'deactivated'} successfully`,
        automation: updatedAutomation,
      };
    } catch (error) {
      logger.error('Toggle automation error:', error);
      throw error;
    }
  }
  
  /**
   * Schedule an automation
   */
  static async scheduleAutomation(automationId: string) {
    try {
      // Get automation details
      const automation = await prisma.automation.findUnique({
        where: { id: automationId },
      });
      
      if (!automation) {
        throw new Error('Automation not found');
      }
      
      // Add automation job to queue
      await automationQueue.add('processAutomation', {
        automationId,
        trigger: automation.trigger,
        conditions: automation.conditions,
        actions: automation.actions,
      }, {
        repeat: {
          // This would be configured based on the trigger type
          // For example, for a daily trigger:
          // pattern: '0 9 * * *' // Every day at 9 AM
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });
      
      logger.info(`Automation ${automationId} scheduled successfully`);
    } catch (error) {
      logger.error('Schedule automation error:', error);
      throw error;
    }
  }
}