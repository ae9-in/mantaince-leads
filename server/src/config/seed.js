import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from './db.js';

export const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding (SQL)...');

    // 1. Seed Roles
    const rolesToSeed = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'super_admin', permissions: ['*'] },
      { id: '00000000-0000-0000-0000-000000000002', name: 'vertical_admin', permissions: [
        'leads:read', 'leads:create', 'leads:update', 'leads:delete_own',
        'vertical:read', 'sub_vertical:manage', 'users:read', 'users:invite',
        'csv:upload', 'csv:template', 'csv:logs', 'reports:read'
      ]},
      { id: '00000000-0000-0000-0000-000000000003', name: 'agent', permissions: [
        'leads:read_own', 'leads:create', 'leads:update_own', 'csv:upload', 'csv:template'
      ]},
    ];

    for (const r of rolesToSeed) {
      await query(`
        INSERT INTO roles (id, name, permissions) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (name) DO UPDATE SET permissions = $3, updated_at = NOW()
      `, [r.id, r.name, r.permissions]);
    }
    console.log('🔑 Roles verified.');

    // 2. Seed Super Admin
    const adminEmail = 'admin@gmail.com';
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    await query(`
        INSERT INTO users (id, name, email, password_hash, role_id, is_active, is_approved)
        VALUES ($1, $2, $3, $4, $5, true, true)
        ON CONFLICT (email) DO UPDATE SET password_hash = $4, role_id = $5, is_approved = true, updated_at = NOW()
    `, [crypto.randomUUID(), 'Super Administrator', adminEmail, passwordHash, rolesToSeed[0].id]);
    
    console.log('👤 Default Super Admin verified (admin@gmail.com / admin123).');

    // 3. Create Sample Vertical
    const vId = crypto.randomUUID();
    await query(`
        INSERT INTO verticals (id, name, slug, description, color, icon)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO NOTHING
    `, [vId, 'Real Estate', 'real-estate', 'Property listings leads', '#185FA5', 'Home']);

    // Create Test Vertical
    const testVId = '0f26e60c-09fe-43e3-83c6-b8ece895d365';
    await query(`
        INSERT INTO verticals (id, name, slug, description, color, icon)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO NOTHING
    `, [testVId, 'test vertical', 'test-vertical', 'Test environment vertical', '#8B5CF6', 'Beaker']);

    console.log('🚀 Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding Error:', error.message);
  }
};

import { fileURLToPath } from 'url';
import path from 'path';

// If run directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
    seedDatabase().then(() => process.exit(0));
}

