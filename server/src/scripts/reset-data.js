/**
 * reset-data.js
 * 
 * Clears ALL application data except super_admin users.
 * Preserves: roles table, super_admin users + their sessions.
 * Deletes:   leads, csv_upload_logs, audit_logs, field_configs,
 *            sub_verticals, verticals, assignments, sessions for non-admins,
 *            and all non-super_admin users.
 *
 * Usage:
 *   node src/scripts/reset-data.js
 */

import { connectDB, query } from '../config/db.js';

async function resetData() {
  console.log('🔄 Connecting to database...');
  await connectDB();

  console.log('\n📋 Starting data reset — preserving super_admin users only...\n');

  // 1. Wipe all leads (cascade will handle related data)
  const leadsResult = await query(`DELETE FROM leads`);
  console.log(`✅ Deleted ${leadsResult.rowCount} leads`);

  // 2. Wipe CSV upload logs
  const csvResult = await query(`DELETE FROM csv_upload_logs`);
  console.log(`✅ Deleted ${csvResult.rowCount} CSV upload logs`);

  // 3. Wipe audit logs
  const auditResult = await query(`DELETE FROM audit_logs`);
  console.log(`✅ Deleted ${auditResult.rowCount} audit log entries`);

  // 4. Wipe field configs (will be cascade-deleted with verticals, but do it explicitly)
  const fieldsResult = await query(`DELETE FROM field_configs`);
  console.log(`✅ Deleted ${fieldsResult.rowCount} field configs`);

  // 5. Wipe user assignments
  const assignmentsResult = await query(`DELETE FROM user_assignments`);
  console.log(`✅ Deleted ${assignmentsResult.rowCount} user assignments`);

  // 6. Wipe sub-verticals
  const subVertsResult = await query(`DELETE FROM sub_verticals`);
  console.log(`✅ Deleted ${subVertsResult.rowCount} sub-verticals`);

  // 7. Wipe verticals
  const vertsResult = await query(`DELETE FROM verticals`);
  console.log(`✅ Deleted ${vertsResult.rowCount} verticals`);

  // 8. Delete all sessions for non-super_admin users
  const sessionsResult = await query(`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name != 'super_admin'
    )
  `);
  console.log(`✅ Deleted ${sessionsResult.rowCount} non-admin sessions`);

  // 9. Delete non-super_admin users
  const usersResult = await query(`
    DELETE FROM users
    WHERE role_id IN (
      SELECT id FROM roles WHERE name != 'super_admin'
    )
  `);
  console.log(`✅ Deleted ${usersResult.rowCount} non-admin users`);

  // 10. Show what's been kept
  const keptAdmins = await query(`
    SELECT u.name, u.email, r.name AS role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at ASC
  `);

  console.log('\n✅ Reset complete! Preserved admin accounts:\n');
  console.table(keptAdmins.rows.map(a => ({ name: a.name, email: a.email, role: a.role })));
}

resetData()
  .then(() => {
    console.log('\n🎉 Database reset finished successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Reset failed:', err.message);
    process.exit(1);
  });
