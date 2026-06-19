import express from 'express';
import { getAuditLogs } from '../controllers/audit.js';
import authenticate from '../middleware/authenticate.js';
import attachRole from '../middleware/attachRole.js';
import checkPermission from '../middleware/checkPermission.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

router.get('/', checkPermission(['reports:read', 'leads:read_own', 'leads:read']), getAuditLogs);

export default router;
