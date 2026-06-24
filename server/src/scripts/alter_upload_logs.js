import { query, connectDB } from '../config/db.js';

async function run() {
    await connectDB();
    console.log("Adding columns to csv_upload_logs...");
    await query(`
        ALTER TABLE csv_upload_logs 
        ADD COLUMN IF NOT EXISTS sub_vertical_id UUID REFERENCES sub_verticals(id) ON DELETE CASCADE;
    `);
    await query(`
        ALTER TABLE csv_upload_logs 
        ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log("Columns added successfully!");
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
