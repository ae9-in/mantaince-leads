import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from './db.js';
import { PERMISSIONS } from '../middleware/auth.js';

export const seedDatabase = async () => {
  try {
    console.log('Checking database seeding...');

    // 1. Seed Roles with static, recognizable UUIDs
    const rolesToSeed = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'super_admin', permissions: PERMISSIONS.super_admin },
      { id: '00000000-0000-0000-0000-000000000002', name: 'vertical_admin', permissions: PERMISSIONS.vertical_admin },
      { id: '00000000-0000-0000-0000-000000000003', name: 'agent', permissions: PERMISSIONS.agent },
    ];

    for (const r of rolesToSeed) {
      const existing = await query('SELECT * FROM roles WHERE name = $1', [r.name]);
      if (existing.rows.length === 0) {
        await query(
          'INSERT INTO roles (id, name, permissions) VALUES ($1, $2, $3)',
          [r.id, r.name, r.permissions]
        );
        console.log(`Role created: ${r.name}`);
      } else {
        // Update permissions in case they changed in middleware
        await query(
          'UPDATE roles SET permissions = $1, updated_at = NOW() WHERE name = $2',
          [r.permissions, r.name]
        );
      }
    }

    // 2. Seed Super Admin User
    const adminEmail = 'admin@gmail.com';
    const existingAdmin = await query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    const superAdminRole = rolesToSeed[0];

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('admin123', salt);

    if (existingAdmin.rows.length === 0) {
      const adminId = crypto.randomUUID();
      await query(
        `INSERT INTO users (id, name, email, password_hash, role_id, vertical_access, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'Super Admin', adminEmail, passwordHash, superAdminRole.id, [], true]
      );
      console.log(`Default Super Admin created: ${adminEmail} / admin123`);
    } else {
      // Update credentials and ensure active status
      await query(
        `UPDATE users 
         SET name = $1, password_hash = $2, role_id = $3, is_active = $4, updated_at = NOW()
         WHERE email = $5`,
        ['Super Admin', passwordHash, superAdminRole.id, true, adminEmail]
      );
      console.log(`Super Admin credentials updated: ${adminEmail} / admin123`);
    }

    console.log('Database seeding verified successfully.');
  } catch (error) {
    console.error('Error during database seeding:', error.message);
  }
};
