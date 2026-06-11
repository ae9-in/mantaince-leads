import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { 
  getLeads, 
  getLeadById, 
  createLead, 
  updateLead, 
  deleteLead, 
  importCsv, 
  getCsvLogs, 
  exportLeads 
} from '../controllers/leads.js';
import { authenticate, attachRole, checkPermission, injectScope } from '../middleware/auth.js';

const router = express.Router();

// Configure local uploads directory within workspace
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middlewares applied to all routes in this router
router.use(authenticate);
router.use(attachRole);

// Lead Endpoints
router.get('/', checkPermission('leads:read'), injectScope, getLeads);
router.get('/export', checkPermission('leads:read'), injectScope, exportLeads);
router.get('/import/logs', checkPermission('csv:upload'), getCsvLogs);
router.get('/:id', checkPermission('leads:read'), getLeadById);
router.post('/', checkPermission('leads:create'), createLead);
router.put('/:id', checkPermission('leads:update'), updateLead);
router.delete('/:id', checkPermission('leads:delete'), deleteLead);

// CSV upload route
router.post('/import', checkPermission('csv:upload'), upload.single('file'), importCsv);

export default router;
