import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

export const validate = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error:any) {
      if (error instanceof z.ZodError) {
        logger.error('Validation error:', error?.issues);
        return res.status(400).json({
          message: 'Validation failed',
          errors: error?.issues.map((err: { path: any[]; message: any; }) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};