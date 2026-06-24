/**
 * cleanDummyData.js
 * Removes "real-estate" and all dummy/test verticals + their associated data
 * from the database. Keeps only the real operational verticals.
 *
 * Usage: node server/src/scripts/cleanDummyData.js
 */

import { connectDB, query } from '../config/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// REAL operational verticals to KEEP (by slug).
// Everything else is treated as dummy / test data and will be deleted.
// ─────────────────────────────────────────────────────────────────────────────
const KEEP_VERTICALS = [
  'milletpro',
  'pooja-jaya-janrdhana',
  'soaps-aroma-dew',
  'erp-saas',
  'competitions',
  'ace-it-up',
  'etiquettes',
];

async function run() {
  try {
    await connectDB();
    console.log('🧹 Starting dummy data cleanup...\n');

    // ------------------------------------------------------------------
    // 1. Find ALL verticals currently in the DB
    // ------------------------------------------------------------------
    const allVerticalsRes = await query('SELECT id, name, slug FROM verticals ORDER BY slug');
    const allVerticals = allVerticalsRes.rows;
    console.log(`Found ${allVerticals.length} vertical(s) in DB:`);
    allVerticals.forEach(v => console.log(`  - ${v.name} (${v.slug})`));
    console.log('');

    // ------------------------------------------------------------------
    // 2. Separate into KEEP and DELETE
    // ------------------------------------------------------------------
    const toDelete = allVerticals.filter(v => !KEEP_VERTICALS.includes(v.slug));
    const toKeep   = allVerticals.filter(v =>  KEEP_VERTICALS.includes(v.slug));

    if (toDelete.length === 0) {
      console.log('✅ No dummy verticals found to delete.');
    } else {
      console.log(`🗑️  Will DELETE ${toDelete.length} vertical(s) (and all their leads/sub-verticals):`);
      toDelete.forEach(v => console.log(`  ❌ ${v.name} (${v.slug})`));
      console.log('');

      // Delete leads (cost_conversions) first, then sub_verticals, then verticals
      for (const v of toDelete) {
        // Remove follow_ups linked to leads in this vertical
        await query(`
          DELETE FROM follow_ups
          WHERE cost_conversion_id IN (
            SELECT id FROM cost_conversions WHERE vertical_id = $1
          )
        `, [v.id]);

        // Remove cost_conversions for this vertical
        const leadsRes = await query(
          'DELETE FROM cost_conversions WHERE vertical_id = $1 RETURNING id',
          [v.id]
        );
        console.log(`  🗑️  Deleted ${leadsRes.rowCount} lead(s) from "${v.name}"`);

        // Remove csv_upload_logs for this vertical
        await query('DELETE FROM csv_upload_logs WHERE vertical_id = $1', [v.id]);

        // Remove field_configs
        await query('DELETE FROM field_configs WHERE vertical_id = $1', [v.id]);

        // Remove sub_verticals (cascades remaining references)
        const subsRes = await query(
          'DELETE FROM sub_verticals WHERE vertical_id = $1 RETURNING name',
          [v.id]
        );
        console.log(`  🗑️  Deleted ${subsRes.rowCount} sub-vertical(s) from "${v.name}"`);

        // Finally, delete the vertical itself
        await query('DELETE FROM verticals WHERE id = $1', [v.id]);
        console.log(`  ✅ Deleted vertical "${v.name}" (${v.slug})\n`);
      }
    }

    // ------------------------------------------------------------------
    // 3. For kept verticals, also remove any orphaned / dummy leads
    //    that have no valid sub_vertical_id
    // ------------------------------------------------------------------
    const orphanRes = await query(`
      DELETE FROM cost_conversions
      WHERE is_deleted = false
        AND sub_vertical_id IS NULL
        AND vertical_id = ANY($1::uuid[])
      RETURNING id, name
    `, [toKeep.map(v => v.id)]);

    if (orphanRes.rowCount > 0) {
      console.log(`🗑️  Deleted ${orphanRes.rowCount} orphaned lead(s) with no sub-vertical.`);
    }

    // ------------------------------------------------------------------
    // 4. Verify state after cleanup
    // ------------------------------------------------------------------
    const finalVerticalsRes = await query('SELECT id, name, slug FROM verticals ORDER BY name');
    console.log(`\n✅ Remaining verticals (${finalVerticalsRes.rowCount}):`);
    for (const v of finalVerticalsRes.rows) {
      const subsRes = await query(
        'SELECT name FROM sub_verticals WHERE vertical_id = $1 AND is_active = true ORDER BY display_order',
        [v.id]
      );
      const leadsRes = await query(
        'SELECT COUNT(*) AS cnt FROM cost_conversions WHERE vertical_id = $1 AND is_deleted = false',
        [v.id]
      );
      const leadCount = leadsRes.rows[0]?.cnt || 0;
      console.log(`  ✅ ${v.name} (${v.slug}) → ${subsRes.rowCount} sub-vertical(s), ${leadCount} lead(s)`);
      subsRes.rows.forEach(s => console.log(`       · ${s.name}`));
    }

    // ------------------------------------------------------------------
    // 5. Refresh materialized view
    // ------------------------------------------------------------------
    try {
      await query('SELECT refresh_mv_vertical_tree()');
      console.log('\n✅ Materialized view refreshed.');
    } catch (_) {
      // Non-fatal
    }

    console.log('\n✅ Dummy data cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Cleanup failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
