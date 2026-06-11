import express from 'express';
import multer from 'multer';
import { 
  getLeads, 
  createLead, 
  getLeadById, 
  updateLead, 
  deleteLead, 
  updateLeadStatus, 
  assignLead, 
  exportLeadsCsv 
} from '../controllers/leads.js';
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

// CSV Upload specific routes (Section 4 specifications)
router.get('/csv/template/:verticalId', checkPermission('csv:template'), downloadCsvTemplate);
router.post('/csv/upload', checkPermission('csv:upload'), upload.single('file'), uploadCsv);
router.get('/csv/logs', checkPermission('csv:logs'), getCsvLogs);
router.get('/csv/logs/:batchId', checkPermission('csv:logs'), getCsvLogById);
router.get('/csv/logs/:batchId/failed-rows', checkPermission('csv:logs'), streamFailedRows);

// Standard Leads routes
router.get('/', checkPermission(['leads:read', 'leads:read_own']), getLeads);
router.post('/', checkPermission('leads:create'), createLead);
router.get('/export/csv', checkPermission(['leads:read', 'leads:read_own']), exportLeadsCsv);

router.get('/:id', checkPermission(['leads:read', 'leads:read_own']), getLeadById);
router.patch('/:id', checkPermission(['leads:update', 'leads:update_own']), updateLead);
router.delete('/:id', checkPermission(['leads:delete', 'leads:delete_own']), deleteLead);

router.patch('/:id/status', checkPermission(['leads:update', 'leads:update_own']), updateLeadStatus);
router.patch('/:id/assign', checkPermission('vertical:read'), assignLead);

export default router;
