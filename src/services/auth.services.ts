import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {prisma} from '../config/database';
import { logger } from '../utils/logger';
import {config} from 'dotenv';
config();

export class AuthService {
  /**
   * Register a new user
   */
  static async register(email: string, password: string, name?: string) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      
      if (existingUser) {
        throw new Error('User already exists');
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
      
      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!);
      
      return { user, token };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }
  
  /**
   * Login user
   */
  static async login(email: string, password: string) {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });
      
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }
      
      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!);
      
      const { password: _, ...userWithoutPassword } = user;
      
      return { user: userWithoutPassword, token };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile
   */
  static async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          domains: true,
        },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }
}