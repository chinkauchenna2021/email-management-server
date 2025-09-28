import { Router } from 'express';
import { DomainController } from '../controllers/domain.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Domain routes
router.post('/', rateLimiter(60, 10), DomainController.addDomain);
router.get('/', DomainController.getUserDomains);
router.get('/stats', DomainController.getAllDomainsWithStats);
router.get('/:domainId', DomainController.getDomainStats);
router.put('/:domainId/settings', DomainController.updateDomainSettings);
router.post('/:domainId/verify', DomainController.verifyDomain);
router.post('/:domainId/test-smtp', DomainController.testSmtpSettings);
router.delete('/:domainId', DomainController.deleteDomain);

export default router;