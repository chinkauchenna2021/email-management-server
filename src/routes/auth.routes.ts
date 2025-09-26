import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router:Router = Router();

// Public routes
router.post('/register', rateLimiter(60, 5), AuthController.register);
router.post('/login', rateLimiter(60, 5), AuthController.login);

// Protected routes
router.get('/profile', authenticate, AuthController.getProfile);

export default router;