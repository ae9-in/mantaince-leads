import connectDB from '../config/db.js';
import { csvQueue } from './queue.js';
import { processCsvJob } from './csvProcessor.js';

// 1. Connect to Database (Required to make Mongoose queries work inside worker)
connectDB();

console.log('👷 LeadsBase Queue Worker Process Starting...');

// 2. Bind Queue Processor
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

// Event listeners for reporting
csvQueue.on('active', (job) => {
  console.log(`🏃 Job ${job.id} is now active.`);
});

csvQueue.on('completed', (job, result) => {
  console.log(`🎉 Job ${job.id} has completed.`);
});

csvQueue.on('failed', (job, err) => {
  console.error(`💔 Job ${job.id} failed with error: ${err.message}`);
});

process.on('SIGTERM', async () => {
  console.log('Worker shutting down gracefully...');
  await csvQueue.close();
  process.exit(0);
});
