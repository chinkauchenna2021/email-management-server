import { Router } from 'express';
import { AutomationController } from '../controllers/automation.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Automation routes
router.post('/', rateLimiter(60, 5), AutomationController.createAutomation);
router.get('/', AutomationController.getUserAutomations);
router.get('/:automationId', AutomationController.getAutomation);
router.put('/:automationId', AutomationController.updateAutomation);
router.delete('/:automationId', AutomationController.deleteAutomation);
router.post('/:automationId/toggle', AutomationController.toggleAutomation);

export default router;