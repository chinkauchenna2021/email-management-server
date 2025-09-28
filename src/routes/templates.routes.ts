import { Router } from 'express';
import { TemplateController } from '../controllers/templates.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Template routes
router.post('/', rateLimiter(60, 10), TemplateController.createTemplate);
router.get('/', TemplateController.getUserTemplates);
router.get('/categories', TemplateController.getTemplateCategories);
router.get('/:templateId', TemplateController.getTemplate);
router.put('/:templateId', TemplateController.updateTemplate);
router.delete('/:templateId', TemplateController.deleteTemplate);
router.post('/:templateId/use', TemplateController.useTemplate);

export default router;