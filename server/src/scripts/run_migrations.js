import { connectDB } from '../config/db.js';

async function run() {
  console.log('🔄 Triggering database connection and migrations...');
  await connectDB();
  console.log('🎉 Migrations execution finished.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
