import pg from 'pg';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    PGHOST,
    PGPORT,
    PGUSER,
    PGPASSWORD,
    PGDATABASE,
    USE_RDS_IAM,
    AWS_REGION
} from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const caBundlePath = path.normalize(path.resolve(__dirname, '../../../global-bundle.pem'));

const { Pool } = pg;

// ── IAM Token Cache ───────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getAuthToken() {
    if (USE_RDS_IAM !== 'true') {
        return PGPASSWORD;
    }
    // Reuse token if still valid (IAM tokens last 15min; refresh at 10min)
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }
    const signer = new AWS.RDS.Signer({
        region: AWS_REGION || 'eu-north-1',
        hostname: PGHOST,
        port: parseInt(PGPORT || '5432', 10),
        username: PGUSER || 'postgres'
    });
    console.log('🔄 Generating new RDS IAM Token...');
    cachedToken = signer.getAuthToken({});
    tokenExpiry = Date.now() + 600_000; // 10 minutes
    return cachedToken;
}

// ── Connection Pool ───────────────────────────────────────────────────────────
const pool = new Pool({
    host:     PGHOST,
    port:     parseInt(PGPORT || '5432', 10),
    user:     PGUSER || 'postgres',
    database: PGDATABASE || 'postgres',
    password: getAuthToken,          // Dynamic resolver — fetches IAM token on demand
    ssl: {
        rejectUnauthorized: false,
        ca: fs.existsSync(caBundlePath) ? fs.readFileSync(caBundlePath).toString() : undefined
    },
    // Performance-tuned pool settings
    max:                    25,      // Raised from 20 — handles higher concurrency bursts
    idleTimeoutMillis:      30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle:        false,
    statement_timeout:      10000,   // Natively enforce 10s hard limit on statement execution
});

// Surface idle-client errors before they cause silent failures
pool.on('error', (err) => {
    console.error('❌ Idle pool client error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

// ── Database Initialization ───────────────────────────────────────────────────
export const connectDB = async () => {
    try {
        console.log(`📡 Attempting to connect to RDS: ${PGHOST}:${PGPORT} as ${PGUSER}`);
        const client = await pool.connect();
        console.log(`✅ RDS Connected: ${PGHOST}`);
        client.release();
        await runMigrations();
    } catch (err) {
        console.error('❌ RDS Connection Error:', err.message);
        if (!process.env.VERCEL) {
            process.exit(1);
        } else {
            throw err;
        }
    }
};

// ── Migrations ────────────────────────────────────────────────────────────────
// Split into 3 phases so a transient error in phase 2/3 never blocks phase 1.
const runMigrations = async () => {
    console.log('🏗️ Running database migrations...');

    // ── Phase 1: Core Schema ─────────────────────────────────────────────────
    const coreDdl = `
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
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
            vertical_access UUID[] DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            last_login_at TIMESTAMP,
            invite_token VARCHAR(255),
            invite_token_expiry TIMESTAMP,
            created_by UUID,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS verticals (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            description TEXT,
            color VARCHAR(50) DEFAULT '#185FA5',
            icon VARCHAR(50) DEFAULT 'Layers',
            display_order INTEGER DEFAULT 0,
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
            display_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_vertical_slug UNIQUE (vertical_id, slug)
        );

        CREATE TABLE IF NOT EXISTS lead_stages (
            id UUID PRIMARY KEY,
            sub_vertical_id UUID NOT NULL REFERENCES sub_verticals(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            is_active BOOLEAN DEFAULT TRUE,
            is_table_column BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_vertical_field_key UNIQUE (vertical_id, field_key)
        );

        CREATE TABLE IF NOT EXISTS csv_upload_logs (
            id UUID PRIMARY KEY,
            uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
            file_name VARCHAR(255),
            original_file_name VARCHAR(255),
            total_rows INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            duplicate_count INTEGER DEFAULT 0,
            errors JSONB DEFAULT '[]',
            status VARCHAR(50) DEFAULT 'processing',
            processing_started_at TIMESTAMP,
            processing_finished_at TIMESTAMP,
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
            search_vector TSVECTOR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            stage_id UUID REFERENCES lead_stages(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS user_assignments (
            id UUID PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            sub_vertical_id UUID REFERENCES sub_verticals(id) ON DELETE CASCADE,
            assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, sub_vertical_id)
        );

        CREATE TABLE IF NOT EXISTS custom_fields (
            id VARCHAR(50) PRIMARY KEY,
            sub_vertical_id UUID NOT NULL REFERENCES sub_verticals(id) ON DELETE CASCADE,
            label VARCHAR(255) NOT NULL,
            field_key VARCHAR(255) NOT NULL,
            field_type VARCHAR(50) DEFAULT 'TEXT',
            is_required BOOLEAN DEFAULT FALSE,
            placeholder VARCHAR(255),
            options TEXT[] DEFAULT '{}',
            "order" INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_sub_vertical_field_key UNIQUE (sub_vertical_id, field_key)
        );

        CREATE TABLE IF NOT EXISTS lead_custom_values (
            id VARCHAR(50) PRIMARY KEY,
            lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            custom_field_id VARCHAR(50) REFERENCES custom_fields(id) ON DELETE CASCADE,
            value TEXT NOT NULL,
            CONSTRAINT unique_lead_custom_field UNIQUE (lead_id, custom_field_id)
        );

        CREATE TABLE IF NOT EXISTS follow_ups (
            id VARCHAR(50) PRIMARY KEY,
            lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            sub_vertical_id UUID NOT NULL REFERENCES sub_verticals(id) ON DELETE CASCADE,
            assigned_to_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            follow_up_date TIMESTAMP NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'PENDING',
            completed_at TIMESTAMP,
            completed_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            ip VARCHAR(50),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        DO $$
        BEGIN
            -- Check if audit_logs table exists and is NOT partitioned
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'audit_logs'
            ) AND NOT EXISTS (
                SELECT 1 FROM pg_partitioned_table p
                JOIN pg_class c ON p.partrelid = c.oid
                WHERE c.relname = 'audit_logs'
            ) THEN
                -- Rename existing table
                ALTER TABLE audit_logs RENAME TO audit_logs_old;
                
                -- Create partitioned table
                CREATE TABLE audit_logs (
                    id UUID NOT NULL,
                    actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    action VARCHAR(255) NOT NULL,
                    target_collection VARCHAR(255) NOT NULL,
                    target_id UUID,
                    diff JSONB,
                    ip VARCHAR(50),
                    execution_time_ms INTEGER,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id, created_at)
                ) PARTITION BY RANGE (created_at);
                
                -- Create default partition
                CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
                
                -- Create specific partitions for 2026
                CREATE TABLE IF NOT EXISTS audit_logs_y2026m06 PARTITION OF audit_logs
                    FOR VALUES FROM ('2026-06-01 00:00:00') TO ('2026-07-01 00:00:00');
                CREATE TABLE IF NOT EXISTS audit_logs_y2026m07 PARTITION OF audit_logs
                    FOR VALUES FROM ('2026-07-01 00:00:00') TO ('2026-08-01 00:00:00');
                CREATE TABLE IF NOT EXISTS audit_logs_y2026m08 PARTITION OF audit_logs
                    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');
                    
                -- Copy data from old table to new partitioned table
                INSERT INTO audit_logs (id, actor_id, action, target_collection, target_id, diff, ip, execution_time_ms, created_at)
                SELECT id, actor_id, action, target_collection, target_id, diff, ip, execution_time_ms, created_at
                FROM audit_logs_old;
                
                -- Drop old table
                DROP TABLE audit_logs_old;
            ELSIF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'audit_logs'
            ) THEN
                -- Create partitioned table directly if it doesn't exist
                CREATE TABLE audit_logs (
                    id UUID NOT NULL,
                    actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    action VARCHAR(255) NOT NULL,
                    target_collection VARCHAR(255) NOT NULL,
                    target_id UUID,
                    diff JSONB,
                    ip VARCHAR(50),
                    execution_time_ms INTEGER,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id, created_at)
                ) PARTITION BY RANGE (created_at);
                
                -- Create default partition
                CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
                
                -- Create specific partitions for 2026
                CREATE TABLE IF NOT EXISTS audit_logs_y2026m06 PARTITION OF audit_logs
                    FOR VALUES FROM ('2026-06-01 00:00:00') TO ('2026-07-01 00:00:00');
                CREATE TABLE IF NOT EXISTS audit_logs_y2026m07 PARTITION OF audit_logs
                    FOR VALUES FROM ('2026-07-01 00:00:00') TO ('2026-08-01 00:00:00');
                CREATE TABLE IF NOT EXISTS audit_logs_y2026m08 PARTITION OF audit_logs
                    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');
            END IF;
        END $$;

        -- Ensure additive columns exist (idempotent)
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token_expiry TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS vertical_access UUID[] DEFAULT '{}';

        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255);
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip VARCHAR(50);
        ALTER TABLE sessions ALTER COLUMN token DROP NOT NULL;
        ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;

        ALTER TABLE verticals ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT '#185FA5';
        ALTER TABLE verticals ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'Layers';
        ALTER TABLE verticals ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
        ALTER TABLE verticals ADD COLUMN IF NOT EXISTS statuses JSONB DEFAULT '[]';
        ALTER TABLE sub_verticals ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
        ALTER TABLE lead_stages ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

        ALTER TABLE field_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE field_configs ADD COLUMN IF NOT EXISTS is_table_column BOOLEAN DEFAULT TRUE;
        ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;

        ALTER TABLE csv_upload_logs ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255);
        ALTER TABLE csv_upload_logs ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 0;
        ALTER TABLE csv_upload_logs ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;
        ALTER TABLE csv_upload_logs ADD COLUMN IF NOT EXISTS processing_finished_at TIMESTAMP;
        ALTER TABLE csv_upload_logs ALTER COLUMN file_name DROP NOT NULL;

        -- FTS column (idempotent)
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

        -- Additive columns for leads table
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type VARCHAR(50) NOT NULL DEFAULT 'CALL';
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS geotag_lat DOUBLE PRECISION;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS geotag_lng DOUBLE PRECISION;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS geotag_accuracy DOUBLE PRECISION;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS geotag_photo_key TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS geotag_address TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS geotag_captured_at TIMESTAMP;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES lead_stages(id) ON DELETE SET NULL;

        -- Migrate user_assignments from vertical_id to sub_vertical_id if vertical_id column exists
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_assignments' AND column_name = 'vertical_id'
            ) THEN
                -- Drop the unique constraint first
                ALTER TABLE user_assignments DROP CONSTRAINT IF EXISTS user_assignments_user_id_vertical_id_key;
                
                -- Add new columns if they do not exist
                ALTER TABLE user_assignments ADD COLUMN IF NOT EXISTS sub_vertical_id UUID REFERENCES sub_verticals(id) ON DELETE CASCADE;
                ALTER TABLE user_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;
                
                -- Drop column vertical_id
                ALTER TABLE user_assignments DROP COLUMN IF EXISTS vertical_id;
                
                -- Add new unique constraint
                ALTER TABLE user_assignments ADD CONSTRAINT user_assignments_user_id_sub_vertical_id_key UNIQUE (user_id, sub_vertical_id);
            END IF;
        END $$;
    `;

    // ── Phase 2: Performance Indexes ─────────────────────────────────────────
    const perfDdl = `
        CREATE EXTENSION IF NOT EXISTS pg_trgm;

        -- Trigram indexes: fast ILIKE fallback for short/partial searches
        CREATE INDEX IF NOT EXISTS idx_leads_name_trgm     ON leads USING gin (name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm    ON leads USING gin (phone gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_leads_biz_trgm      ON leads USING gin (business_name gin_trgm_ops);

        -- JSONB GIN index for data field queries
        CREATE INDEX IF NOT EXISTS idx_leads_data_gin ON leads USING gin (data);

        -- Foreign key indexes (critical for JOIN performance)
        CREATE INDEX IF NOT EXISTS idx_sub_verticals_vertical_id ON sub_verticals(vertical_id);
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_id         ON leads(vertical_id);
        CREATE INDEX IF NOT EXISTS idx_leads_sub_vertical_id     ON leads(sub_vertical_id);
        CREATE INDEX IF NOT EXISTS idx_leads_assigned_to         ON leads(assigned_to);

        -- B-Tree indexes for exact matches & filtering
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_phone_btree ON leads (vertical_id, phone);
        CREATE INDEX IF NOT EXISTS idx_leads_csv_batch_id ON leads (csv_batch_id);

        -- COVERING INDEX: Lead list query satisfied entirely from the index — no heap fetch.
        -- Covers: vertical_id filter + is_deleted filter + created_at sort + id sort
        -- INCLUDE columns are the exact fields returned by the list SELECT
        DROP INDEX IF EXISTS idx_leads_list_covering;
        CREATE INDEX IF NOT EXISTS idx_leads_list_covering
            ON leads (vertical_id, created_at DESC, id DESC)
            INCLUDE (name, phone, business_name, status, assigned_to, sub_vertical_id, updated_at)
            WHERE is_deleted = false;

        -- Report optimizations: Status, Area (expression), Agent performance, Conversion trend
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_status_covering ON leads (vertical_id, status) WHERE is_deleted = false;
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_area_expr ON leads (vertical_id, (data->>'area')) WHERE is_deleted = false;
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_assigned ON leads (vertical_id, assigned_to) WHERE is_deleted = false;
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_created_status ON leads (vertical_id, created_at, status) WHERE is_deleted = false;

        -- PARTIAL INDEX: "My Leads" agent view — only assigned + open leads
        CREATE INDEX IF NOT EXISTS idx_leads_assigned_open
            ON leads (assigned_to, vertical_id, created_at DESC)
            WHERE is_deleted = false;

        -- BRIN INDEX: Date-range queries on created_at — 100× smaller than B-tree.
        -- Effective because leads are inserted in approximately chronological order.
        CREATE INDEX IF NOT EXISTS idx_leads_created_brin ON leads USING BRIN (created_at);

        -- Performance sort & filter indexes for active leads
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_name ON leads (vertical_id, name) WHERE is_deleted = false;
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_business_name ON leads (vertical_id, business_name) WHERE is_deleted = false;
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_updated_at ON leads (vertical_id, updated_at DESC, id DESC) WHERE is_deleted = false;
        CREATE INDEX IF NOT EXISTS idx_leads_vertical_sub_vertical ON leads (vertical_id, sub_vertical_id) WHERE is_deleted = false;


        -- Performance indexes for new tables
        CREATE INDEX IF NOT EXISTS idx_custom_fields_sub_vertical_order ON custom_fields (sub_vertical_id, is_active, "order");
        CREATE INDEX IF NOT EXISTS idx_lead_custom_values_lead_id ON lead_custom_values (lead_id);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_date ON follow_ups (lead_id, follow_up_date);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_target_collection ON audit_logs (target_collection);

        CREATE INDEX IF NOT EXISTS idx_follow_ups_sub_vertical_date ON follow_ups (sub_vertical_id, follow_up_date);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_status_date ON follow_ups (assigned_to_id, status, follow_up_date);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups (follow_up_date);
        CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads (lead_type, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lead_stages_sub_vertical ON lead_stages (sub_vertical_id, display_order);
        CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads (stage_id);

        -- Statistics: help query planner on low-cardinality status/source columns
        ALTER TABLE leads ALTER COLUMN status SET STATISTICS 500;
        ALTER TABLE leads ALTER COLUMN source SET STATISTICS 200;

        -- Autovacuum tuning for write-heavy import workloads
        ALTER TABLE leads SET (
            autovacuum_vacuum_scale_factor  = 0.05,
            autovacuum_analyze_scale_factor = 0.02,
            autovacuum_vacuum_cost_delay    = 2,
            fillfactor                      = 80
        );
    `;

    // ── Phase 3: Full-Text Search ────────────────────────────────────────────
    const ftsDdl = `
        -- GIN index on search_vector for fast @@ queries
        CREATE INDEX IF NOT EXISTS idx_leads_search_gin ON leads USING GIN (search_vector);

        -- Trigger: auto-maintain search_vector on every INSERT or relevant UPDATE
        CREATE OR REPLACE FUNCTION update_lead_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', coalesce(NEW.name, '')),          'A') ||
                setweight(to_tsvector('english', coalesce(NEW.business_name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.phone, '')),         'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_leads_search_vector ON leads;
        CREATE TRIGGER trg_leads_search_vector
            BEFORE INSERT OR UPDATE OF name, business_name, phone
            ON leads
            FOR EACH ROW EXECUTE FUNCTION update_lead_search_vector();
    `;

    try {
        await query(coreDdl);
        console.log('✅ Phase 1: Core schema migrations completed.');
    } catch (err) {
        console.error('❌ Phase 1 Migration Error:', err.message);
    }

    try {
        await query(perfDdl);
        console.log('✅ Phase 2: Performance index migrations completed.');
    } catch (err) {
        console.error('❌ Phase 2 Migration Error:', err.message);
    }

    try {
        await query(ftsDdl);
        console.log('✅ Phase 3: Full-text search setup completed.');

        // Backfill search_vector for existing rows asynchronously — non-blocking startup
        setImmediate(async () => {
            try {
                const result = await query(`
                    UPDATE leads
                    SET search_vector = (
                        setweight(to_tsvector('english', coalesce(name, '')),          'A') ||
                        setweight(to_tsvector('english', coalesce(business_name, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(phone, '')),         'B')
                    )
                    WHERE search_vector IS NULL AND is_deleted = false
                `);
                if (result.rowCount > 0) {
                    console.log(`✅ Backfilled search_vector for ${result.rowCount} existing leads.`);
                }
            } catch (backfillErr) {
                console.error('⚠️ search_vector backfill (non-fatal):', backfillErr.message);
            }
        });
    } catch (err) {
        console.error('❌ Phase 3 Migration Error:', err.message);
    }

    console.log('✅ All database migrations completed.');
};

export default pool;
