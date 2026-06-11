import pg from 'pg';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const caBundlePath = path.resolve(__dirname, '../../../global-bundle.pem');

const { Pool } = pg;

let pool = null;
let cachedToken = null;
let tokenExpiry = 0;

async function getPassword() {
  const useIam = process.env.USE_RDS_IAM === 'true';
  
  if (useIam) {
    // Return cached token if still valid (tokens are valid for 15 mins, we cache for 10)
    if (cachedToken && Date.now() < tokenExpiry) {
      return cachedToken;
    }

    try {
      const signer = new AWS.RDS.Signer({
        region: process.env.AWS_REGION || 'eu-north-1',
        hostname: process.env.PGHOST,
        port: parseInt(process.env.PGPORT || '5432', 10),
        username: process.env.PGUSER || 'postgres'
      });
      
      console.log('🔄 Generating new RDS IAM Authentication Token...');
      const token = signer.getAuthToken({});
      
      // Cache token for 10 minutes (10 * 60 * 1000 ms)
      cachedToken = token;
      tokenExpiry = Date.now() + 600000; 
      
      return token;
    } catch (err) {
      console.warn('⚠️ Failed to get RDS IAM token, falling back to static password:', err.message);
    }
  }
  
  return process.env.PGPASSWORD || 'Aksharaenp@2025';
}

export const connectDB = async () => {
  try {
    pool = new Pool({
      host: process.env.PGHOST || 'database-1.cluster-c56mq42qi4nb.eu-north-1.rds.amazonaws.com',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      database: process.env.PGDATABASE || 'postgres',
      password: getPassword,
      ssl: process.env.PGSSL === 'true' || process.env.PGSSL === undefined
        ? { 
            rejectUnauthorized: false,
            ca: fs.existsSync(caBundlePath) ? fs.readFileSync(caBundlePath).toString() : undefined
          }
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await pool.connect();
    console.log(`PostgreSQL Connected to host: ${client.host}`);
    client.release();

    // Run migrations
    await runMigrations();
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`);
    process.exit(1);
  }
};

export const closeDB = async () => {
  if (pool) {
    await pool.end();
    console.log('PostgreSQL connection closed.');
  }
};

export const query = (text, params) => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB first.');
  }
  return pool.query(text, params);
};

export const getClient = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB first.');
  }
  return pool.connect();
};

const runMigrations = async () => {
  const ddl = `
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      permissions TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role_id UUID REFERENCES roles(id) ON DELETE RESTRICT,
      vertical_access UUID[] DEFAULT '{}',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS verticals (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sub_verticals (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT TRUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_vertical_slug UNIQUE (vertical_id, slug)
    );

    CREATE TABLE IF NOT EXISTS field_configs (
      id UUID PRIMARY KEY,
      vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
      field_key VARCHAR(255) NOT NULL,
      label VARCHAR(255) NOT NULL,
      field_type VARCHAR(50) NOT NULL,
      options TEXT[] DEFAULT '{}',
      is_required BOOLEAN DEFAULT FALSE,
      is_csv_mapped BOOLEAN DEFAULT FALSE,
      csv_header VARCHAR(255),
      display_order INTEGER DEFAULT 0,
      is_visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_vertical_field_key UNIQUE (vertical_id, field_key)
    );

    CREATE TABLE IF NOT EXISTS csv_upload_logs (
      id UUID PRIMARY KEY,
      uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      total_rows INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      errors JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'processing',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY,
      vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
      sub_vertical_id UUID REFERENCES sub_verticals(id) ON DELETE SET NULL,
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      business_name VARCHAR(255),
      data JSONB DEFAULT '{}',
      status VARCHAR(50) DEFAULT 'new',
      source VARCHAR(50) DEFAULT 'manual',
      csv_batch_id UUID REFERENCES csv_upload_logs(id) ON DELETE SET NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP,
      deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- New table for User Assignments Tracking
    CREATE TABLE IF NOT EXISTS user_assignments (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      vertical_id UUID REFERENCES verticals(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT TRUE,
      last_assigned_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, vertical_id)
    );

    -- Partial index to prevent duplicate phones in same vertical
    CREATE UNIQUE INDEX IF NOT EXISTS unique_vertical_phone
    ON leads(vertical_id, phone)
    WHERE phone IS NOT NULL AND phone != '';

    CREATE INDEX IF NOT EXISTS idx_leads_query1 ON leads(vertical_id, assigned_to, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_query2 ON leads(vertical_id, sub_vertical_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_data_area ON leads ((data->>'area'));

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(255) NOT NULL,
      target_collection VARCHAR(255) NOT NULL,
      target_id UUID,
      diff JSONB,
      ip VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Fix field_configs table PRIMARY KEY ID definition (it should be UUID PRIMARY KEY)
  // Wait, let's write correct syntax: id UUID PRIMARY KEY
  const fixedDdl = ddl.replace('id PRIMARY KEY DEFAULT gen_random_uuid(),', 'id UUID PRIMARY KEY,');

  console.log('Running database migrations...');
  await query(fixedDdl);
  console.log('Database migrations completed.');
};
