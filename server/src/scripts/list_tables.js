import pool from '../config/db.js';

async function listRowCounts() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    for (const row of res.rows) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}";`);
      console.log(`- ${row.table_name}: ${countRes.rows[0].count} rows`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error listing row counts:', err);
    process.exit(1);
  }
}

listRowCounts();
