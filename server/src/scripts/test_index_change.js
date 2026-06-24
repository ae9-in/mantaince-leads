import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    console.log("Dropping existing unique index...");
    await query("DROP INDEX IF EXISTS mv_vertical_tree_pk");
    
    console.log("Creating unique index on (vertical_id, sub_vertical_id)...");
    try {
        await query(`
            CREATE UNIQUE INDEX mv_vertical_tree_pk 
            ON mv_vertical_tree (vertical_id, sub_vertical_id);
        `);
        console.log("Index created successfully!");
    } catch (e) {
        console.error("Index creation failed:", e.message);
    }
    
    console.log("Attempting concurrent refresh...");
    try {
        await query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vertical_tree");
        console.log("✅ CONCURRENT REFRESH SUCCEEDED!");
    } catch (e) {
        console.error("❌ Concurrent refresh failed:", e.message);
    }
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
