/**
 * Performance Monitoring Middleware
 *
 * - Adds X-Response-Time header to every response
 * - Logs structured JSON for requests > SLOW_THRESHOLD_MS (80ms target)
 * - Skips health checks and OPTIONS preflight requests
 */

const SLOW_THRESHOLD_MS = Number(process.env.SLOW_THRESHOLD_MS) || 2000; // Configurable slow threshold, defaults to 2000ms for WAN databases

export const performanceMonitor = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationNs = process.hrtime.bigint() - start;
        const ms = Number(durationNs / 1_000_000n);

        // Only set header if it hasn't been sent yet (streaming responses may already be done)
        if (!res.headersSent) {
            res.setHeader('X-Response-Time', `${ms}ms`);
        }

        // Skip noisy low-value logs
        if (req.originalUrl === '/health' || req.method === 'OPTIONS') return;

        if (ms > SLOW_THRESHOLD_MS) {
            // Structured JSON for CloudWatch Logs Insights queries
            const logEntry = {
                type:    'slow_request',
                method:  req.method,
                url:     req.originalUrl,
                status:  res.statusCode,
                ms,
                // Include user context if authenticated (helps triage per-role slowness)
                userId:  req.user?.sub  ?? null,
                role:    req.user?.role ?? null,
            };

            if (process.env.NODE_ENV === 'production') {
                // Production: single-line JSON for structured log ingestion
                console.log(JSON.stringify(logEntry));
            } else {
                // Development: human-readable with emoji prefix
                console.log(`⏱️  Slow [${ms}ms] ${req.method} ${req.originalUrl} (${res.statusCode})`);
            }
        }
    });

    next();
};

export default performanceMonitor;
