 import { Router } from 'express';
import { DomainController } from '../controllers/domain.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router:Router = Router();

// All routes are protected
router.use(authenticate);

// Domain routes
router.post('/', rateLimiter(60, 10), DomainController.addDomain);
router.get('/', DomainController.getUserDomains);
router.post('/:domainId/verify', DomainController.verifyDomain);
router.delete('/:domainId', DomainController.deleteDomain);

export default router;