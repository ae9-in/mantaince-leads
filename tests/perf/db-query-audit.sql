-- Database Performance Audit
-- Checks indexing status and suggestions for slow queries

-- 1. Identify slow queries currently registered in pg_stat_statements (if available)
SELECT 
    query, 
    calls, 
    total_exec_time / 1000.0 as total_exec_seconds,
    mean_exec_time as mean_exec_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2. Verify existence of required performance indexes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('leads', 'follow_ups', 'lead_stages')
ORDER BY tablename, indexname;

-- 3. Check sequential scans (potential slow queries without indexes)
SELECT 
    relname AS table_name,
    seq_scan AS sequential_scans,
    seq_tup_read AS tuples_read_by_seq_scan,
    idx_scan AS index_scans
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
