import { execSync } from 'child_process';

const TEST_DB_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://postgres:Akshara123@leadsbase-db.c56mq42qi4nb.eu-north-1.rds.amazonaws.com:5430/postgres';

export async function setup() {
  process.env.DATABASE_URL = TEST_DB_URL;

  // Run migrations on test DB (in non-destructive deploy mode)
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe',
    });
  } catch (err) {
    console.warn('[Setup Warning]: prisma migrate deploy skipped or failed:', err.message);
  }
}

export async function teardown() {
  const { prisma } = await import('../../server/src/lib/prisma.js');
  try {
    // Truncate tables for cleanup
    await prisma.$executeRaw`
      TRUNCATE TABLE
        "users", "leads", "custom_fields", "lead_custom_values", "follow_ups", "sub_verticals", "verticals"
      RESTART IDENTITY CASCADE
    `;
  } catch (err) {
    // Suppress if tables don't exist yet or match raw schema
  }
  await prisma.$disconnect();
}

export const fixtures = {
  superAdmin: {
    id: 'test-superadmin-id',
    name: 'Super Admin',
    email: 'superadmin@test.com',
    role: 'super_admin',
    passwordHash: '$2b$10$test...',
    isActive: true,
  },
  admin: {
    id: 'test-admin-id',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'vertical_admin',
    isActive: true,
  },
  agent: {
    id: 'test-agent-id',
    name: 'Test Agent',
    email: 'agent@test.com',
    role: 'agent',
    isActive: true,
  },
  vertical: {
    id: 'test-vertical-id',
    name: 'Finance',
    slug: 'finance',
    color: '#6366F1',
    isActive: true,
    order: 1,
  },
  subVertical: {
    id: 'test-sv-id',
    verticalId: 'test-vertical-id',
    name: 'Insurance',
    slug: 'insurance',
    isActive: true,
    order: 1,
    leadCount: 0,
  },
};
