import pool from '../config/db.js';

async function listTriggers() {
  try {
    const res = await pool.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      ORDER BY trigger_name;
    `);
    console.log('Triggers in database:');
    res.rows.forEach(row => {
      console.log(`- ${row.trigger_name} on ${row.event_object_table} (${row.event_manipulation})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error listing triggers:', err);
    process.exit(1);
  }
}

listTriggers();
