import express from 'express';
import { 
  getStatusDistribution, 
  getAreaDistribution, 
  getConversionOverTime, 
  getAgentPerformance,
  getReportsSummary
} from '../controllers/reports.js';
import authenticate from '../middleware/authenticate.js';
import attachRole from '../middleware/attachRole.js';
import checkPermission from '../middleware/checkPermission.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

// Reports specific paths
router.get('/status-distribution',  checkPermission('reports:read'), getStatusDistribution);
router.get('/area-distribution',    checkPermission('reports:read'), getAreaDistribution);
router.get('/conversion-over-time', checkPermission('reports:read'), getConversionOverTime);
router.get('/agent-performance',    checkPermission('reports:read'), getAgentPerformance);
// Parallel summary endpoint: returns all 4 metrics in one request (dashboard optimisation)
router.get('/summary',              checkPermission('reports:read'), getReportsSummary);

export default router;
