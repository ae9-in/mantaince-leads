import express from 'express';
import { getFieldConfigs, createOrUpdateFieldConfig, deleteFieldConfig } from '../controllers/configs.js';
import { authenticate, attachRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

router.get('/verticals/:verticalId/configs', getFieldConfigs);
router.post('/verticals/:verticalId/configs', createOrUpdateFieldConfig);
router.delete('/:id', deleteFieldConfig);

export default router;
