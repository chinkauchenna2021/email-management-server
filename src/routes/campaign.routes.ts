import { Router } from 'express';
import { CampaignController } from '../controllers/campaign.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

// All routes are protected
router.use(authenticate);

// Campaign routes
router.post('/', rateLimiter(6, 5000000), CampaignController.createCampaign);
router.get('/', CampaignController.getUserCampaigns);
router.get('/stats', CampaignController.getOverallCampaignStats);
router.get('/:campaignId', CampaignController.getCampaignDetails);
router.put('/:campaignId', CampaignController.updateCampaign);
router.delete('/:campaignId', CampaignController.deleteCampaign);
router.post('/:campaignId/send', rateLimiter(6, 30000000), CampaignController.sendCampaign);
router.get('/:campaignId/stats', CampaignController.getCampaignStats);
router.post('/:campaignId/retry', rateLimiter(6, 300000000), CampaignController.retryFailedEmails);
// Add this route to the existing routes
router.get('/recent', CampaignController.getRecentCampaigns);

export default router;