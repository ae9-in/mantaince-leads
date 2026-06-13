# Advanced Performance Audit Report - Leads Maintenance System
Date: June 12, 2026

## 1. Database Layer (PostgreSQL)

### Current Status
- **Schema**: PostgreSQL with complex relational schema.
- **Indexes**: Basic B-Tree indexes on primary and foreign keys exist. Covering indexes and Trigram indexes are already implemented in `db.js` migrations.
- **Query Strategy**: Uses cursor-based pagination for lead lists, which is $O(\log N)$.
- **Pool Management**: `pg` pool configured with a max of 25 connections and statement timeouts.

### Identified Bottlenecks
- **Statistics**: Low-cardinality columns like `status` may benefit from higher statistics targets for better query planning.
- **Audit Logs**: The `audit_logs` table grows indefinitely and could slow down insertions if not partitioned or pruned.
- **FTS Updates**: Triggers for full-text search add overhead to every INSERT/UPDATE.

### Recommendations
1.  **Partitioning**: Consider partitioning the `audit_logs` table by month.
2.  **Vacuum Tuning**: The `leads` table is write-heavy; autovacuum settings have already been tuned in migrations, but `VACUUM ANALYZE` should be run manually after large imports.
3.  **Statement Timeout**: Ensure all queries have a strict timeout (currently 10s set in pool).

## 2. API & Caching Layer (Node.js/Upstash Redis)

### Current Status
- **Caching Strategy**: Cache-aside pattern using Upstash Redis.
- **Invalidation**: Surgical invalidation on lead changes (lists and specific detail keys).
- **SSE**: Real-time updates via SSE reduce polling overhead.

### Identified Bottlenecks
- **JSON Serialization**: Large JSON payloads in `leads.data` can be slow to parse/stringify.
- **Parallelism**: Some controllers use `await` sequentially instead of `Promise.all`.
- **N+1 Queries**: Most joins are handled in single queries, but some complex custom field lookups might still be optimized.

### Recommendations
1.  **Response Compression**: Ensure Gzip/Brotli is enabled at the gateway level (Terraform/CloudFront).
2.  **Batching**: Use `Promise.all` for independent DB lookups.
3.  **Lean Payloads**: Exclude internal fields (like `search_vector`) from all API responses.

## 3. Frontend Layer (React/Vite)

### Current Status
- **Rendering**: TanStack Table with React.
- **State Management**: Zustand (Auth/UI).
- **Optimization**: Lazy loading of routes.

### Identified Bottlenecks
- **Re-renders**: Large lead lists cause re-renders of the entire table if not carefully memoized.
- **Icons**: Heavy use of Lucide icons without icon font/sprite optimization.
- **Images**: Lead photos are served directly without resizing/optimization.

### Recommendations
1.  **Virtualization**: Implement `react-window` or `@tanstack/react-virtual` for the lead list if it exceeds 100 rows per page.
2.  **Memoization**: Use `React.memo` for table row components.
3.  **Image Optimization**: Use a service or backend middleware to serve resized thumbnails of lead photos.

## 4. Infrastructure (AWS/Terraform)

### Current Status
- **Database**: Amazon RDS with IAM Auth.
- **Caching**: ElastiCache/Redis (configured in TF) or Upstash.
- **CDN**: CloudFront.

### Recommendations
1.  **Connection Pooling**: Consider RDS Proxy if the number of serverless instances (lambda/containers) scales high.
2.  **Global Bundle**: Ensure the SSL certificate verification doesn't add significant latency to pool.connect.

---

## Action Plan (Next Steps)
1.  **DB**: Add monthly partitioning for `audit_logs` (if volume justifies).
2.  **API**: Audit all controllers for sequential `await` and convert to `Promise.all`.
3.  **Frontend**: Implement virtualization for the main Leads list.
4.  **Backend**: Optimize CSV processing by using `COPY` instead of `INSERT` if speed is still an issue (currently using bulk `INSERT`).
