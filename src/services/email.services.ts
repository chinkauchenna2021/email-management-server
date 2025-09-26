import prisma from '../config/database';
import { EmailValidator } from '../utils/emailValidator';
import { logger } from '../utils/logger';

export class EmailService {
  /**
   * Create a new email list
   */
  static async createEmailList(userId: string, name: string) {
    try {
      const emailList = await prisma.emailList.create({
        data: {
          userId,
          name,
        },
      });
      
      return emailList;
    } catch (error) {
      logger.error('Create email list error:', error);
      throw error;
    }
  }
  
  /**
   * Get user email lists
   */
  static async getUserEmailLists(userId: string) {
    try {
      const emailLists = await prisma.emailList.findMany({
        where: { userId },
        include: {
          _count: {
            select: { emails: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      return emailLists;
    } catch (error) {
      logger.error('Get user email lists error:', error);
      throw error;
    }
  }
  
  /**
   * Add emails to a list
   */
  static async addEmailsToList(userId: string, listId: string, emails: string[]) {
    try {
      // Check if list exists and belongs to user
      const emailList = await prisma.emailList.findFirst({
        where: { id: listId, userId },
      });
      
      if (!emailList) {
        throw new Error('Email list not found');
      }
      
      // Validate emails
      const validationResults = EmailValidator.validateEmailList(emails);
      
      // Find duplicates
      const duplicates = EmailValidator.findDuplicates(emails);
      
      // Filter valid emails
      const validEmails = validationResults
        .filter(result => result.valid)
        .map(result => result.email);
      
      // Get existing emails in the list
      const existingEmails = await prisma.email.findMany({
        where: {
          listId,
          address: { in: validEmails },
        },
        select: { address: true },
      });
      
      const existingEmailAddresses = existingEmails.map((email: { address: any; }) => email.address);
      
      // Filter out emails that already exist in the list
      const newEmails = validEmails.filter(
        email => !existingEmailAddresses.includes(email)
      );
      
      // Create new email records
      if (newEmails.length > 0) {
        await prisma.email.createMany({
          data: newEmails.map(address => ({
            address,
            listId,
            valid: true,
          })),
        });
      }
      
      return {
        validationResults,
        duplicates,
        addedCount: newEmails.length,
        alreadyExistCount: existingEmailAddresses.length,
        invalidCount: emails.length - validEmails.length,
      };
    } catch (error) {
      logger.error('Add emails to list error:', error);
      throw error;
    }
  }
  
  /**
   * Get emails in a list
   */
  static async getEmailsInList(userId: string, listId: string, page = 1, limit = 20) {
    try {
      // Check if list exists and belongs to user
      const emailList = await prisma.emailList.findFirst({
        where: { id: listId, userId },
      });
      
      if (!emailList) {
        throw new Error('Email list not found');
      }
      
      const skip = (page - 1) * limit;
      
      const [emails, totalCount] = await Promise.all([
        prisma.email.findMany({
          where: { listId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.email.count({
          where: { listId },
        }),
      ]);
      
      return {
        emails,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get emails in list error:', error);
      throw error;
    }
  }
  
  /**
   * Delete an email list
   */
  static async deleteEmailList(userId: string, listId: string) {
    try {
      // Check if list exists and belongs to user
      const emailList = await prisma.emailList.findFirst({
        where: { id: listId, userId },
      });
      
      if (!emailList) {
        throw new Error('Email list not found');
      }
      
      // Delete email list (cascade will delete associated emails)
      await prisma.emailList.delete({
        where: { id: listId },
      });
      
      return { message: 'Email list deleted successfully' };
    } catch (error) {
      logger.error('Delete email list error:', error);
      throw error;
    }
  }
}