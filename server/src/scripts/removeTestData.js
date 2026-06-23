import { connectDB, query } from '../config/db.js';
import { invalidateOnTaxonomyChange } from '../services/cache.js';

const verticalsToKeep = [
  'MilletPro',
  'Pooja - Jaya Janrdhana',
  'Soaps - Aroma Dew',
  'ERP SaaS',
  'Competitions',
  'Ace It Up',
  'Etiquettes'
];

async function removeTestData() {
  console.log('🔄 Connecting to database...');
  await connectDB();

  console.log('\n🧹 Starting removal of test data...');

  // 1. Get the list of verticals we are going to delete
  const placeholderList = verticalsToKeep.map((_, i) => `$${i + 1}`).join(', ');
  const toDeleteRes = await query(`
    SELECT id, name FROM verticals 
    WHERE name NOT IN (${placeholderList})
  `, verticalsToKeep);

  const deleteIds = toDeleteRes.rows.map(v => v.id);
  const deleteNames = toDeleteRes.rows.map(v => v.name);

  if (deleteIds.length === 0) {
    console.log('ℹ️ No test verticals to delete.');
  } else {
    console.log(`📋 Verticals slated for deletion: ${deleteNames.join(', ')}`);

    // Delete verticals (cascades to sub-verticals, leads, custom values, stage configs, configs, follow-ups, etc.)
    const deleteVertsPlaceholders = deleteIds.map((_, i) => `$${i + 1}`).join(', ');
    const vertDeleteRes = await query(`
      DELETE FROM verticals 
      WHERE id IN (${deleteVertsPlaceholders})
    `, deleteIds);
    
    console.log(`✅ Deleted ${vertDeleteRes.rowCount} test verticals (including all cascaded leads & configs).`);
  }

  // 2. Wipe audit logs
  const auditResult = await query(`DELETE FROM audit_logs`);
  console.log(`✅ Deleted ${auditResult.rowCount} audit log entries.`);

  // 3. Wipe CSV upload logs
  const csvResult = await query(`DELETE FROM csv_upload_logs`);
  console.log(`✅ Deleted ${csvResult.rowCount} CSV upload logs.`);

  // 4. Delete sessions of non-admin users
  const sessionsResult = await query(`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name != 'super_admin'
    )
  `);
  console.log(`✅ Deleted ${sessionsResult.rowCount} non-admin sessions.`);

  // 5. Delete non-super_admin users
  const usersResult = await query(`
    DELETE FROM users
    WHERE role_id IN (
      SELECT id FROM roles WHERE name != 'super_admin'
    )
  `);
  console.log(`✅ Deleted ${usersResult.rowCount} non-admin users.`);

  // 6. Invalidate taxonomy and report cache
  console.log('🔄 Invalidating caches...');
  await invalidateOnTaxonomyChange(null);
  console.log('✅ Caches cleared.');

  // 7. Verification printout of remaining verticals
  const remainingVerts = await query(`
    SELECT v.name, COUNT(l.id) as leads_count
    FROM verticals v
    LEFT JOIN leads l ON l.vertical_id = v.id AND l.is_deleted = false
    GROUP BY v.id, v.name
    ORDER BY v.name ASC
  `);
  console.log('\n✨ Remaining Verticals in Database:');
  console.table(remainingVerts.rows);
}

removeTestData()
  .then(() => {
    console.log('\n🎉 Test data removal finished successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Removal failed:', err.message);
    process.exit(1);
  });
