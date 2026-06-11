import express from 'express';
import { getAuditLogs } from '../controllers/audit.js';
import { authenticate, attachRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

router.get('/', getAuditLogs);

export default router;
