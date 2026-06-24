import express from 'express';
import multer from 'multer';
import { 
  getCostConversions, 
  createCostConversion, 
  createCostConversionBulk,
  getCostConversionById, 
  updateCostConversion, 
  deleteCostConversion, 
  updateCostConversionStatus, 
  assignCostConversion, 
  exportCostConversionsCsv,
  uploadCostConversionPhoto
} from '../controllers/costConversions.js';
import {
  downloadCsvTemplate,
  uploadCsv,
  getCsvLogs,
  getCsvLogById,
  streamFailedRows
} from '../controllers/csv.js';
import authenticate from '../middleware/authenticate.js';
import attachRole from '../middleware/attachRole.js';
import checkPermission from '../middleware/checkPermission.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file limit
});

router.use(authenticate);
router.use(attachRole);

// CSV Upload specific routes
router.get('/csv/template/:verticalId', checkPermission('csv:template'), downloadCsvTemplate);
router.post('/csv/upload', checkPermission('csv:upload'), upload.single('file'), uploadCsv);
router.get('/csv/logs', checkPermission('csv:logs'), getCsvLogs);
router.get('/csv/logs/:batchId', checkPermission('csv:logs'), getCsvLogById);
router.get('/csv/logs/:batchId/failed-rows', checkPermission('csv:logs'), streamFailedRows);

// Standard CostConversions routes
router.get('/', checkPermission(['leads:read', 'leads:read_own']), getCostConversions);
router.post('/', checkPermission('leads:create'), createCostConversion);
router.post('/bulk', checkPermission('leads:create'), createCostConversionBulk);
router.get('/export/csv', checkPermission(['leads:read', 'leads:read_own']), exportCostConversionsCsv);

router.get('/:id', checkPermission(['leads:read', 'leads:read_own']), getCostConversionById);
router.patch('/:id', checkPermission(['leads:update', 'leads:update_own']), updateCostConversion);
router.delete('/:id', checkPermission(['leads:delete', 'leads:delete_own']), deleteCostConversion);
router.post('/:id/photo', checkPermission(['leads:update', 'leads:update_own']), upload.single('photo'), uploadCostConversionPhoto);

router.patch('/:id/status', checkPermission(['leads:update', 'leads:update_own']), updateCostConversionStatus);
router.patch('/:id/assign', checkPermission('vertical:read'), assignCostConversion);

export default router;
