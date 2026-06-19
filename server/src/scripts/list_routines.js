import pool from '../config/db.js';

async function listFunctions() {
  try {
    const res = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name;
    `);
    console.log('Functions/Routines in database:');
    res.rows.forEach(row => {
      console.log(`- ${row.routine_name} (${row.routine_type})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error listing routines:', err);
    process.exit(1);
  }
}

listFunctions();
