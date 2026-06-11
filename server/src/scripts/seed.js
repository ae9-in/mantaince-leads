import { connectDB } from '../config/db.js';
import { seedDatabase } from '../config/seed.js';

async function run() {
    await connectDB();
    await seedDatabase();
}

run().then(() => {
    console.log('✅ Script completed.');
    process.exit(0);
}).catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
