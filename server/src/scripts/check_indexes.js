import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    const res = await query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'mv_vertical_tree';
    `);
    console.log("=== INDEXES FOR mv_vertical_tree ===");
    res.rows.forEach(r => console.log(`${r.indexname}: ${r.indexdef}`));
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
