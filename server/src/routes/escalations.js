import express from 'express';
import {
  createEscalation,
  getCostConversionEscalations,
  getAdminEscalationsInbox,
  resolveEscalation,
  rejectEscalation
} from '../controllers/escalations.js';
import authenticate from '../middleware/authenticate.js';
import attachRole from '../middleware/attachRole.js';
import checkPermission from '../middleware/checkPermission.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

// Cost Conversion scoped escalations
router.post('/cost-conversions/:id/escalations', checkPermission(['leads:update', 'leads:update_own']), createEscalation);
router.get('/cost-conversions/:id/escalations', checkPermission(['leads:read', 'leads:read_own']), getCostConversionEscalations);

// Admin Inbox
router.get('/admin/escalations/inbox', checkPermission('reports:read'), getAdminEscalationsInbox);

// Escalation Actions
router.put('/escalations/:id/resolve', checkPermission('reports:read'), resolveEscalation);
router.put('/escalations/:id/reject', checkPermission('reports:read'), rejectEscalation);

export default router;
