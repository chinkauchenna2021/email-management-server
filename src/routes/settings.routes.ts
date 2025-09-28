import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Settings routes
router.get('/', SettingsController.getUserSettings);
router.put('/', SettingsController.updateUserSettings);
router.get('/app', SettingsController.getAppSettings);

export default router;