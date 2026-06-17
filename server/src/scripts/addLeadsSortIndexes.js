import { connectDB, query } from '../config/db.js';

async function addSortIndexes() {
  console.log('🔄 Connecting to database...');
  await connectDB();

  console.log('\n🏗️ Adding performance sort & filter indexes to leads...');

  const sqlCommands = [
    'CREATE INDEX IF NOT EXISTS idx_leads_vertical_name ON leads (vertical_id, name) WHERE is_deleted = false',
    'CREATE INDEX IF NOT EXISTS idx_leads_vertical_business_name ON leads (vertical_id, business_name) WHERE is_deleted = false',
    'CREATE INDEX IF NOT EXISTS idx_leads_vertical_updated_at ON leads (vertical_id, updated_at DESC, id DESC) WHERE is_deleted = false',
    'CREATE INDEX IF NOT EXISTS idx_leads_vertical_sub_vertical ON leads (vertical_id, sub_vertical_id) WHERE is_deleted = false'
  ];

  for (const sql of sqlCommands) {
    console.log(`Executing: ${sql}`);
    await query(sql);
  }

  console.log('✅ Sort and filter indexes created successfully!');
}

addSortIndexes()
  .then(() => {
    console.log('\n🎉 Finished.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Execution failed:', err.message);
    process.exit(1);
  });
