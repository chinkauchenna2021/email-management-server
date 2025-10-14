import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Email list routes
router.post('/lists', rateLimiter(6, 1000000000), EmailController.createEmailList);
router.get('/lists', EmailController.getAllEmailListsWithStats);
router.get('/lists/:listId', EmailController.getEmailListWithStats);
router.put('/lists/:listId', EmailController.updateEmailList);
router.delete('/lists/:listId', EmailController.deleteEmailList);

// Email management routes
router.post('/lists/:listId/emails', rateLimiter(60, 5), EmailController.addEmailsToList);
router.get('/lists/:listId/emails', EmailController.getEmailsInList);

// Email validation routes
router.post('/validate', rateLimiter(60, 10), EmailController.validateEmailBatch);

export default router;