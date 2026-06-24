import { connectDB, query } from '../config/db.js';

async function run() {
    await connectDB();
    const res = await query(`
        SELECT tablename, indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename IN ('cost_conversions', 'follow_ups')
        ORDER BY tablename, indexname;
    `);
    console.log("=== INDEXES ===");
    res.rows.forEach(r => console.log(`${r.tablename}.${r.indexname}: ${r.indexdef}`));
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
