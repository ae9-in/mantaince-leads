import express from 'express';
import {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  getFollowUpSummary,
  getCalendarGrid,
  getCalendarFollowUpsByDate,
  getFollowUpVerticalStats
} from '../controllers/followUps.js';
import authenticate from '../middleware/authenticate.js';
import attachRole from '../middleware/attachRole.js';
import checkPermission from '../middleware/checkPermission.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

// Follow-ups CRUD scoped to a specific cost conversion
router.get('/cost-conversions/:costConversionId/follow-ups', checkPermission(['leads:read', 'leads:read_own']), getFollowUps);
router.post('/cost-conversions/:costConversionId/follow-ups', checkPermission(['leads:update', 'leads:update_own']), createFollowUp);
router.get('/cost-conversions/:costConversionId/follow-ups/summary', checkPermission(['leads:read', 'leads:read_own']), getFollowUpSummary);

// Backward-compatibility aliases: /leads/:id/follow-ups → same handlers
router.get('/leads/:costConversionId/follow-ups', checkPermission(['leads:read', 'leads:read_own']), getFollowUps);
router.post('/leads/:costConversionId/follow-ups', checkPermission(['leads:update', 'leads:update_own']), createFollowUp);
router.get('/leads/:costConversionId/follow-ups/summary', checkPermission(['leads:read', 'leads:read_own']), getFollowUpSummary);

// Actions on single follow-up
router.put('/follow-ups/:id', checkPermission(['leads:update', 'leads:update_own']), updateFollowUp);
router.delete('/follow-ups/:id', checkPermission(['leads:update', 'leads:update_own']), deleteFollowUp);

// Calendar queries for vertical
router.get('/verticals/:verticalId/follow-ups/calendar', checkPermission(['leads:read', 'leads:read_own']), getCalendarGrid);
router.get('/verticals/:verticalId/follow-ups/by-date', checkPermission(['leads:read', 'leads:read_own']), getCalendarFollowUpsByDate);
router.get('/verticals/:verticalId/follow-ups/stats', checkPermission(['leads:read', 'leads:read_own']), getFollowUpVerticalStats);

export default router;
