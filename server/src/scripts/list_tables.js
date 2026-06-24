import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    const res = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    `);
    console.log("=== TABLES ===");
    res.rows.forEach(r => console.log(r.table_name));
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
