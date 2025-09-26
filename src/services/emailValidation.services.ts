import { EmailValidator } from '../utils/emailValidator';
import { logger } from '../utils/logger';

export class EmailValidationService {
  /**
   * Validate a single email
   */
  static async validateEmail(email: string) {
    try {
      const result = EmailValidator.validateEmail(email);
      return result;
    } catch (error) {
      logger.error('Email validation error:', error);
      throw error;
    }
  }
  
  /**
   * Validate a batch of emails
   */
  static async validateEmailBatch(emails: string[]) {
    try {
      const results = EmailValidator.validateEmailList(emails);
      const duplicates = EmailValidator.findDuplicates(emails);
      
      return {
        results,
        duplicates,
        summary: {
          total: emails.length,
          valid: results.filter(r => r.valid).length,
          invalid: results.filter(r => !r.valid).length,
          duplicates: duplicates.length,
        },
      };
    } catch (error) {
      logger.error('Email batch validation error:', error);
      throw error;
    }
  }
}