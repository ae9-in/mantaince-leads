import { connectDB, query } from '../config/db.js';

async function run() {
    try {
        await connectDB();
        console.log('Connecting to database...');
        const vertRes = await query(`
            SELECT v.id, v.name, COUNT(l.id) as count
            FROM verticals v
            JOIN cost_conversions l ON l.vertical_id = v.id
            GROUP BY v.id, v.name
            ORDER BY count DESC
            LIMIT 1
        `);
        if (vertRes.rows.length === 0) {
            console.log('No verticals with leads found.');
            process.exit(0);
        }
        const verticalId = vertRes.rows[0].id;
        console.log(`Auditing queries for vertical: ${vertRes.rows[0].name} (${verticalId}) with ${vertRes.rows[0].count} leads`);

        // 1. Status Distribution
        console.log('\n--- 1. Status Distribution Query Plan ---');
        const plan1 = await query(`
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT status AS _id, COUNT(*) AS count
            FROM cost_conversions
            WHERE vertical_id = $1 AND is_deleted = false
            GROUP BY status
        `, [verticalId]);
        console.log(plan1.rows.map(r => r['QUERY PLAN']).join('\n'));

        // 2. Area Distribution
        console.log('\n--- 2. Area Distribution Query Plan ---');
        const plan2 = await query(`
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT data->>'area' AS _id, COUNT(*) AS count
            FROM cost_conversions
            WHERE vertical_id = $1 AND is_deleted = false AND data ? 'area'
            GROUP BY data->>'area'
            ORDER BY count DESC
            LIMIT 10
        `, [verticalId]);
        console.log(plan2.rows.map(r => r['QUERY PLAN']).join('\n'));

        // 3. Conversion Trend
        console.log('\n--- 3. Conversion Trend Query Plan ---');
        const plan3 = await query(`
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT
                EXTRACT(YEAR FROM created_at)  AS year,
                EXTRACT(WEEK FROM created_at)  AS week,
                COUNT(*)                       AS total,
                COUNT(*) FILTER (WHERE status = 'converted') AS converted
            FROM cost_conversions
            WHERE vertical_id = $1 AND is_deleted = false
              AND created_at >= NOW() - INTERVAL '90 days'
            GROUP BY year, week
            ORDER BY year, week
        `, [verticalId]);
        console.log(plan3.rows.map(r => r['QUERY PLAN']).join('\n'));

        // 4. Agent Performance
        console.log('\n--- 4. Agent Performance Query Plan ---');
        const plan4 = await query(`
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT
                u.id    AS _id,
                u.name,
                u.email,
                COUNT(l.id)                                               AS "totalAssigned",
                COUNT(l.id) FILTER (WHERE l.status = 'converted')        AS converted,
                (CASE
                    WHEN COUNT(l.id) > 0
                    THEN ROUND(COUNT(l.id) FILTER (WHERE l.status = 'converted')::numeric / COUNT(l.id) * 100, 2)
                    ELSE 0
                END)::float                                               AS "conversionRate"
            FROM users u
            JOIN cost_conversions l ON l.assigned_to = u.id
            WHERE l.vertical_id = $1 AND l.is_deleted = false
            GROUP BY u.id, u.name, u.email
            ORDER BY "conversionRate" DESC
        `, [verticalId]);
        console.log(plan4.rows.map(r => r['QUERY PLAN']).join('\n'));

        process.exit(0);
    } catch (err) {
        console.error('Error running audit:', err);
        process.exit(1);
    }
}

run();
