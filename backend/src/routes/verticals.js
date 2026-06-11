import express from 'express';
import { 
  getVerticals, 
  getVerticalById, 
  createVertical, 
  updateVertical, 
  getSubVerticals, 
  createSubVertical, 
  updateSubVertical 
} from '../controllers/verticals.js';
import { authenticate, attachRole, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Middlewares applied to all routes in this router
router.use(authenticate);
router.use(attachRole);

// Verticals
router.get('/', getVerticals);
router.get('/:id', getVerticalById);
router.post('/', checkPermission('vertical:manage'), createVertical); // Restricts to super_admin (has wildcard '*')
router.put('/:id', checkPermission('vertical:manage'), updateVertical);

// SubVerticals under a vertical
router.get('/:verticalId/subverticals', getSubVerticals);
router.post('/:verticalId/subverticals', checkPermission('sub_vertical:manage'), createSubVertical);
router.put('/subverticals/:id', checkPermission('sub_vertical:manage'), updateSubVertical);

export default router;
