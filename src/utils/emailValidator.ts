import { logger } from './logger';

export interface ValidationResult {
  email: string;
  valid: boolean;
  reason?: string;
  score?: number;
}

export class EmailValidator {
  /**
   * Validate email syntax and domain
   */
  static validateEmail(email: string): ValidationResult {
    const result: ValidationResult = { email, valid: false };
    
    // Basic syntax validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      result.reason = 'Invalid email format';
      return result;
    }
    
    // Extract domain
    const domain = email.split('@')[1];
    
    // Check for disposable email domains (simplified example)
    const disposableDomains = ['mailinator.com', '10minutemail.com', 'guerrillamail.com'];
    if (disposableDomains.includes(domain.toLowerCase())) {
      result.reason = 'Disposable email domain';
      return result;
    }
    
    // Additional checks could be added here (MX record check, etc.)
    
    result.valid = true;
    result.score = 0.9; // Confidence score
    return result;
  }
  
  /**
   * Validate a list of emails
   */
  static validateEmailList(emails: string[]): ValidationResult[] {
    return emails.map(email => this.validateEmail(email));
  }
  
  /**
   * Check for duplicates in email list
   */
  static findDuplicates(emails: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const email of emails) {
      if (seen.has(email.toLowerCase())) {
        duplicates.add(email);
      } else {
        seen.add(email.toLowerCase());
      }
    }
    
    return Array.from(duplicates);
  }
}