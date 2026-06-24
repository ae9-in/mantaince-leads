import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    const tables = ['cost_conversions', 'cost_conversion_stages', 'cost_conversion_custom_values', 'follow_ups', 'escalations', 'rate_limit_counters'];
    for (const table of tables) {
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1;
        `, [table]);
        console.log(`\n=== COLUMNS FOR ${table.toUpperCase()} ===`);
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    }
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
