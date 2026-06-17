import { connectDB, query } from '../config/db.js';

async function addIndexes() {
  console.log('🔄 Connecting to database...');
  await connectDB();

  console.log('\n🏗️ Adding performance indexes to audit_logs...');

  const sqlCommands = [
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_target_collection ON audit_logs (target_collection)'
  ];

  for (const sql of sqlCommands) {
    console.log(`Executing: ${sql}`);
    await query(sql);
  }

  console.log('✅ Indexes created successfully!');
}

addIndexes()
  .then(() => {
    console.log('\n🎉 Finished.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Execution failed:', err.message);
    process.exit(1);
  });
