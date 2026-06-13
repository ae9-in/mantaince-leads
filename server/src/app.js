import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { PORT, CLIENT_URL } from './config/env.js';
import pool, { connectDB } from './config/db.js';
import performanceMonitor from './middleware/performance.js';
import { connectAllRedisClients } from './lib/redis.js';
import { closeAllClients } from './services/assignmentBroadcaster.js';

// Route imports
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import verticalsRouter from './routes/verticals.js';
import configsRouter from './routes/configs.js';
import leadsRouter from './routes/leads.js';
import auditRouter from './routes/audit.js';
import reportsRouter from './routes/reports.js';
import assignmentsRouter from './routes/assignments.js';
import adminRouter from './routes/admin.js';
import followUpsRouter from './routes/followUps.js';
import { csvQueue } from './jobs/queue.js';
import { processCsvJob } from './jobs/csvProcessor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// 1. Performance and Optimization Middleware
app.use(performanceMonitor);
app.use(compression());

// 2. Establish DB + Redis Connections
connectDB();
// Redis: non-fatal — cache will degrade gracefully if unavailable
connectAllRedisClients().catch((err) => {
  console.error('[Redis] Startup connection failed (non-fatal):', err.message);
});

// 3. Register Security & Parsing Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const isAllowed = 
      origin === CLIENT_URL ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:3000' ||
      origin === 'https://mantaince-leads.vercel.app' ||
      origin.endsWith('.vercel.app');
      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ETag support: enables 304 Not Modified for unchanged GET responses (browser cache)
app.set('etag', 'weak');

// MongoDB Compatibility Helper: Recursively copy 'id' to '_id' and convert snake_case to camelCase keys
const mapIdToUnderscoreId = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(mapIdToUnderscoreId);
  }
  if (typeof obj === 'object') {
    // Avoid mapping internal Express/Axios/Buffer or special object classes
    if (obj.constructor && obj.constructor.name !== 'Object' && obj.constructor.name !== 'Array') {
      return obj;
    }
    const newObj = {};
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const mappedVal = mapIdToUnderscoreId(obj[key]);
      newObj[key] = mappedVal;
      if (camelKey !== key && camelKey !== '__proto__' && camelKey !== 'constructor' && camelKey !== 'prototype') {
        newObj[camelKey] = mappedVal;
      }
    }
    if (obj.id !== undefined && obj._id === undefined) {
      newObj._id = obj.id;
    }
    return newObj;
  }
  return obj;
};

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (body !== null && body !== undefined && typeof body === 'object') {
      if (body.success && body.data !== undefined) {
        body.data = mapIdToUnderscoreId(body.data);
      } else {
        body = mapIdToUnderscoreId(body);
      }
    }
    return originalJson.call(this, body);
  };
  next();
});

// 4. Register Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/verticals', verticalsRouter);
app.use('/api/v1/configs', configsRouter); // Support field endpoints directly
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/assignments', assignmentsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/followUps', followUpsRouter);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Lightweight status checkpoint endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'online', time: new Date() } });
});

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'LeadsBase API is operational. Access endpoints via /api/v1' });
});

// 5. Global Error Handling Middleware (Section 11 specifications)
app.use((err, req, res, next) => {
  console.error('❌ Server Error Context:', err);

  // PostgreSQL Unique Violation (code 23505)
  if (err.code === '23505') {
    const detailMatch = err.detail?.match(/Key \((.*?)\)=\((.*?)\) already exists/);
    const key = detailMatch ? detailMatch[1] : 'field';
    return res.status(409).json({
      success: false,
      error: `Resource collision. Field '${key}' must be unique and already exists.`
    });
  }

  // PostgreSQL Invalid Input Syntax (e.g. bad UUID format)
  if (err.code === '22P02') {
    return res.status(400).json({
      success: false,
      error: `Invalid resource identifier format`
    });
  }

  // Multer File Size Limit check
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File upload size exceeds the maximum limit (10MB).'
    });
  }

  // Fallback internal error
  const response = {
    success: false,
    error: 'An internal server error occurred during transaction processing.'
  };

  if (process.env.NODE_ENV !== 'production') {
    response.details = err.stack || err.message;
  }

  return res.status(err.status || 500).json(response);
});

// Register Bull Queue Worker in the server process to ensure it runs concurrently
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  console.log('👷 Centralized CSV Queue Worker Initializing...');
  
  csvQueue.process(async (job) => {
    console.log(`⏳ Job started: Batch ${job.data.batchId} (Job ID ${job.id})`);
    try {
      await processCsvJob(job);
      console.log(`✅ Job finished successfully: Batch ${job.data.batchId}`);
    } catch (error) {
      console.error(`❌ Job failed: Batch ${job.data.batchId} - Error: ${error.message}`);
      throw error;
    }
  });

  csvQueue.on('active', (job) => {
    console.log(`🏃 Job ${job.id} is now active.`);
  });

  csvQueue.on('completed', (job) => {
    console.log(`🎉 Job ${job.id} has completed.`);
  });

  csvQueue.on('failed', (job, err) => {
    console.error(`💔 Job ${job.id} failed with error: ${err.message}`);
  });
}

// Start listening
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 LeadsBase API Listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Graceful shutdown handler (trigger nodemon restart)
  const shutdown = async (signal) => {
    console.log(`🛑 ${signal} received — shutting down gracefully...`);
    
    // 1. Close all SSE clients immediately to release handles
    try {
      closeAllClients();
    } catch (err) {
      console.error('Failed to close SSE clients:', err.message);
    }

    // 2. Close HTTP server so it stops accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed.');
      });
    }

    // If it's a nodemon restart (SIGUSR2), exit immediately to release port
    if (signal === 'SIGUSR2') {
      console.log('Nodemon restart: exiting process immediately to free port.');
      process.exit(0);
    }

    // 3. Close database connection pool (with 1s timeout)
    try {
      if (pool && typeof pool.end === 'function') {
        await Promise.race([
          pool.end(),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        console.log('Database connection pool closed.');
      }
    } catch (err) {
      console.error('Failed to close database pool:', err.message);
    }

    // Force exit
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGUSR2', async () => {
    await shutdown('SIGUSR2');
  });
}


export default app;
export { app };
