import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    console.log("Attempting non-concurrent refresh...");
    try {
        await query("REFRESH MATERIALIZED VIEW mv_vertical_tree");
        console.log("✅ Non-concurrent refresh succeeded!");
        
        console.log("Attempting concurrent refresh...");
        await query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vertical_tree");
        console.log("✅ Concurrent refresh succeeded!");
    } catch (e) {
        console.error("❌ Refresh failed:", e.message);
    }
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
