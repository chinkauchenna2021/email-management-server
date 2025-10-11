import {prisma} from '../config/database';
import { logger } from '../utils/logger';

export class TemplateService {
  /**
   * Create a new email template
   */
  static async createTemplate(
    userId: string,
    name: string,
    subject: string,
    content: string,
    category?: string
  ) {
    try {
      const template = await prisma.emailTemplate.create({
        data: {
          userId,
          name,
          subject,
          content,
          category,
        },
      });
      
      return template;
    } catch (error) {
      logger.error('Create template error:', error);
      throw error;
    }
  }
  
  /**
   * Get all templates for a user
   */
  static async getUserTemplates(userId: string, page = 1, limit = 20, category?: string) {
    try {
      const skip = (page - 1) * limit;
      
      const whereClause: any = { userId };
      if (category) whereClause.category = category;
      
      const [templates, totalCount] = await Promise.all([
        prisma.emailTemplate.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.emailTemplate.count({
          where: whereClause,
        }),
      ]);
      
      return {
        templates,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get user templates error:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific template
   */
  static async getTemplate(userId: string, templateId: string) {
    try {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, userId },
      });
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      return template;
    } catch (error) {
      logger.error('Get template error:', error);
      throw error;
    }
  }
  
  /**
   * Update a template
   */
  static async updateTemplate(
    userId: string,
    templateId: string,
    name?: string,
    subject?: string,
    content?: string,
    category?: string
  ) {
    try {
      // Check if template exists and belongs to user
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, userId },
      });
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Update template
      const updatedTemplate = await prisma.emailTemplate.update({
        where: { id: templateId },
        data: {
          ...(name && { name }),
          ...(subject && { subject }),
          ...(content && { content }),
          ...(category !== undefined && { category }),
        },
      });
      
      return updatedTemplate;
    } catch (error) {
      logger.error('Update template error:', error);
      throw error;
    }
  }
  
  /**
   * Delete a template
   */
  static async deleteTemplate(userId: string, templateId: string) {
    try {
      // Check if template exists and belongs to user
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, userId },
      });
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Delete template
      await prisma.emailTemplate.delete({
        where: { id: templateId },
      });
      
      return { message: 'Template deleted successfully' };
    } catch (error) {
      logger.error('Delete template error:', error);
      throw error;
    }
  }
  
  /**
   * Get all template categories
   */
  static async getTemplateCategories(userId: string) {
    try {
      const categories = await prisma.emailTemplate.findMany({
        where: { userId },
        distinct: ['category'],
        select: { category: true },
      });
      
      // Filter out null categories and extract values
      const categoryList = categories
        .map(c => c.category)
        .filter(category => category !== null) as string[];
      
      return { categories: categoryList };
    } catch (error) {
      logger.error('Get template categories error:', error);
      throw error;
    }
  }
  
  /**
   * Use a template in a campaign
   */
  static async useTemplate(userId: string, templateId: string) {
    try {
      const template = await this.getTemplate(userId, templateId);
      
      return {
        subject: template.subject,
        content: template.content,
        message: 'Template loaded successfully',
      };
    } catch (error) {
      logger.error('Use template error:', error);
      throw error;
    }
  }
}