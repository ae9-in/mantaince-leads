import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    const res = await query("SELECT id, name, created_at, vertical_id FROM leads WHERE vertical_id = '09fc6f21-2726-49c6-b5e4-4adc12198f87'");
    console.log(res.rows);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
