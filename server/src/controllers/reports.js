import { query } from '../config/db.js';
import { withCache } from '../services/cache.js';
import { CacheKeys, TTL } from '../lib/cacheKeys.js';

/**
 * GET /reports/status-distribution
 * Cached 5 min — heavy GROUP BY on potentially large leads table.
 */
export const getStatusDistribution = async (req, res) => {
    const { verticalId, dateFrom, dateTo } = req.query;
    try {
        if (!verticalId) return res.status(400).json({ success: false, error: 'verticalId required' });

        const cacheKey = `${CacheKeys.reportStatus(verticalId)}:${dateFrom ?? ''}:${dateTo ?? ''}`;

        const data = await withCache(cacheKey, TTL.REPORTS, async () => {
            let sql   = 'SELECT status AS _id, COUNT(*) AS count FROM leads WHERE vertical_id = $1 AND is_deleted = false';
            const params = [verticalId];
            let   pIdx   = 2;

            if (dateFrom) { sql += ` AND created_at >= $${pIdx++}`; params.push(dateFrom); }
            if (dateTo)   { sql += ` AND created_at <= $${pIdx++}`; params.push(dateTo); }

            sql += ' GROUP BY status';
            const res2 = await query(sql, params);
            return res2.rows;
        });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /reports/area-distribution
 * Cached 5 min.
 */
export const getAreaDistribution = async (req, res) => {
    const { verticalId } = req.query;
    try {
        if (!verticalId) return res.status(400).json({ success: false, error: 'verticalId required' });

        const data = await withCache(CacheKeys.reportArea(verticalId), TTL.REPORTS, async () => {
            const res2 = await query(`
                SELECT data->>'area' AS _id, COUNT(*) AS count
                FROM leads
                WHERE vertical_id = $1 AND is_deleted = false AND data ? 'area'
                GROUP BY data->>'area'
                ORDER BY count DESC
                LIMIT 10
            `, [verticalId]);
            return res2.rows;
        });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /reports/conversion-over-time
 * Cached 5 min.
 */
export const getConversionOverTime = async (req, res) => {
    const { verticalId } = req.query;
    try {
        if (!verticalId) return res.status(400).json({ success: false, error: 'verticalId required' });

        const data = await withCache(CacheKeys.reportConversion(verticalId), TTL.REPORTS, async () => {
            const res2 = await query(`
                SELECT
                    EXTRACT(YEAR FROM created_at)  AS year,
                    EXTRACT(WEEK FROM created_at)  AS week,
                    COUNT(*)                       AS total,
                    COUNT(*) FILTER (WHERE status = 'converted') AS converted
                FROM leads
                WHERE vertical_id = $1 AND is_deleted = false
                  AND created_at >= NOW() - INTERVAL '90 days'
                GROUP BY year, week
                ORDER BY year, week
            `, [verticalId]);
            return res2.rows;
        });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /reports/agent-performance
 * Cached 5 min.
 */
export const getAgentPerformance = async (req, res) => {
    const { verticalId } = req.query;
    try {
        if (!verticalId) return res.status(400).json({ success: false, error: 'verticalId required' });

        const data = await withCache(CacheKeys.reportAgents(verticalId), TTL.REPORTS, async () => {
            const res2 = await query(`
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
                JOIN leads l ON l.assigned_to = u.id
                WHERE l.vertical_id = $1 AND l.is_deleted = false
                GROUP BY u.id, u.name, u.email
                ORDER BY "conversionRate" DESC
            `, [verticalId]);
            return res2.rows;
        });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /reports/summary
 * Returns all 4 metrics in parallel — single endpoint for dashboard load.
 * Cached entries are re-used from individual endpoints if already warm.
 */
export const getReportsSummary = async (req, res) => {
    const { verticalId } = req.query;
    if (!verticalId) return res.status(400).json({ success: false, error: 'verticalId required' });

    try {
        const [statusDist, areaDist, conversionTime, agentPerf] = await Promise.all([
            withCache(CacheKeys.reportStatus(verticalId),     TTL.REPORTS, () =>
                query('SELECT status AS _id, COUNT(*) AS count FROM leads WHERE vertical_id = $1 AND is_deleted = false GROUP BY status', [verticalId]).then(r => r.rows)
            ),
            withCache(CacheKeys.reportArea(verticalId),       TTL.REPORTS, () =>
                query(`SELECT data->>'area' AS _id, COUNT(*) AS count FROM leads WHERE vertical_id = $1 AND is_deleted = false AND data ? 'area' GROUP BY data->>'area' ORDER BY count DESC LIMIT 10`, [verticalId]).then(r => r.rows)
            ),
            withCache(CacheKeys.reportConversion(verticalId), TTL.REPORTS, () =>
                query(`SELECT EXTRACT(YEAR FROM created_at) AS year, EXTRACT(WEEK FROM created_at) AS week, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'converted') AS converted FROM leads WHERE vertical_id = $1 AND is_deleted = false AND created_at >= NOW() - INTERVAL '90 days' GROUP BY year, week ORDER BY year, week`, [verticalId]).then(r => r.rows)
            ),
            withCache(CacheKeys.reportAgents(verticalId),     TTL.REPORTS, () =>
                query(`SELECT u.id AS _id, u.name, u.email, COUNT(l.id) AS "totalAssigned", COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted, (CASE WHEN COUNT(l.id) > 0 THEN ROUND(COUNT(l.id) FILTER (WHERE l.status = 'converted')::numeric / COUNT(l.id) * 100, 2) ELSE 0 END)::float AS "conversionRate" FROM users u JOIN leads l ON l.assigned_to = u.id WHERE l.vertical_id = $1 AND l.is_deleted = false GROUP BY u.id, u.name, u.email ORDER BY "conversionRate" DESC`, [verticalId]).then(r => r.rows)
            ),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                statusDistribution: statusDist,
                areaDistribution:   areaDist,
                conversionOverTime: conversionTime,
                agentPerformance:   agentPerf,
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
