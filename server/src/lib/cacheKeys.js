/**
 * Cache Key Templates — single source of truth for every Redis key.
 * Using pure functions means keys are predictable, testable, and easily
 * searched across the codebase.
 */

export const CacheKeys = {
    // ── Taxonomy (changes rarely) ─────────────────────────────────────────
    /** All verticals list */
    verticals:      ()             => 'v1:verticals:all',
    /** Single vertical with its sub-verticals embedded */
    verticalFull:   (id)           => `v1:vertical:${id}:full`,
    /** Sub-verticals for one vertical */
    subVerticals:   (verticalId)   => `v1:sv:vertical:${verticalId}`,
    /** All field configs for one vertical */
    fieldConfigs:   (verticalId)   => `v1:configs:${verticalId}:fields`,

    // ── Lead Records ─────────────────────────────────────────────────────
    /** Full lead detail (all columns + joins) */
    leadDetail:     (leadId)       => `v1:lead:${leadId}:detail`,
    /** Paginated lead list page for a vertical + query fingerprint */
    leadListPage:   (verticalId, hash) => `v1:leads:${verticalId}:list:${hash}`,

    // ── Reports / Aggregations ────────────────────────────────────────────
    /** Status distribution report for a vertical */
    reportStatus:   (verticalId)   => `v1:reports:${verticalId}:status`,
    /** Area distribution report for a vertical */
    reportArea:     (verticalId)   => `v1:reports:${verticalId}:area`,
    /** Conversion over time report */
    reportConversion: (verticalId) => `v1:reports:${verticalId}:conversion`,
    /** Agent performance report */
    reportAgents:   (verticalId)   => `v1:reports:${verticalId}:agents`,

    // ── Bulk-invalidation patterns ────────────────────────────────────────
    patterns: {
        /** All lead list pages for a vertical */
        verticalLeads:  (verticalId) => `v1:leads:${verticalId}:list:*`,
        /** All report cache entries for a vertical */
        verticalReports: (verticalId) => `v1:reports:${verticalId}:*`,
        /** All cached sub-verticals */
        allSubVerticals: ()           => 'v1:sv:vertical:*',
        /** All individual vertical caches */
        allVerticalFull: ()           => 'v1:vertical:*:full',
    },
};

/**
 * TTL constants (in seconds) — single source of truth.
 * Grouped by expected data volatility.
 */
export const TTL = {
    VERTICALS:        86_400, // 24h — changes rarely
    SUB_VERTICALS:    86_400, // 24h
    FIELD_CONFIGS:    86_400, // 24h
    LEAD_DETAIL:        900, // 15 min
    LEAD_LIST_PAGE:     120, // 2 min — tolerate slight staleness for lists
    REPORTS:            300, // 5 min — aggregations are expensive, worth caching
};

/**
 * Build a stable hash from a lead list query parameter object.
 * Used to generate a unique cache key per unique filter combination.
 */
export function hashLeadListParams(params) {
    const canonical = JSON.stringify({
        svId:       params.subVerticalId ?? null,
        status:     params.status        ?? null,
        assignedTo: params.assignedTo    ?? null,
        search:     params.search        ?? null,
        area:       params.area          ?? null,
        dateFrom:   params.dateFrom      ?? null,
        dateTo:     params.dateTo        ?? null,
        sortBy:     params.sortBy        ?? 'created_at',
        sortDir:    params.sortDir       ?? 'desc',
        cursor:     params.cursor        ?? null,
        limit:      params.limit         ?? 25,
        csvBatchId: params.csvBatchId    ?? null,
        stageId:    params.stageId       ?? null,
        leadType:   params.leadType      ?? null,
        // RBAC dimension: agent only sees their own leads
        agentId:    params.agentId       ?? null,
    });
    // Simple deterministic hash — not cryptographic
    let hash = 0;
    for (let i = 0; i < canonical.length; i++) {
        hash = ((hash << 5) - hash) + canonical.charCodeAt(i);
        hash |= 0; // Force 32-bit integer
    }
    return Math.abs(hash).toString(36);
}
