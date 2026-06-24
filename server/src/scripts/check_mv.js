import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    const mvs = ['mv_vertical_tree', 'mv_vertical_stats'];
    for (const mv of mvs) {
        try {
            const res = await query(`SELECT * FROM ${mv} LIMIT 0`);
            console.log(`\n=== COLUMNS FOR ${mv.toUpperCase()} ===`);
            console.log(res.fields.map(f => `${f.name}`));
        } catch (e) {
            console.error(`Error querying ${mv}:`, e.message);
        }
    }
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
