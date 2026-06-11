import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    const vertsRes = await query("SELECT id, name FROM verticals");
    console.log("--- VERTICALS & LEADS COUNT ---");
    for (const v of vertsRes.rows) {
        const countRes = await query("SELECT COUNT(*) FROM leads WHERE vertical_id = $1 AND is_deleted = false", [v.id]);
        console.log(`Vertical: ${v.name} (ID: ${v.id}) | Leads Count: ${countRes.rows[0].count}`);
    }
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
