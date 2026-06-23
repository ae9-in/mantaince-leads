import { AsyncLocalStorage } from 'async_hooks';

export const timingContext = new AsyncLocalStorage();

const history = [];
const MAX_HISTORY = 1000;

export function timingMiddleware(req, res, next) {
  const reqStart = process.hrtime.bigint();
  const segments = new Map();

  req.timer = {
    start(label) {
      segments.set(label, { start: process.hrtime.bigint(), ms: null });
    },
    end(label) {
      const seg = segments.get(label);
      if (seg) {
        seg.ms = Number(process.hrtime.bigint() - seg.start) / 1_000_000;
      }
    },
    summary() {
      const totalMs = Number(process.hrtime.bigint() - reqStart) / 1_000_000;
      const segs = [...segments.entries()]
        .filter(([, v]) => v.ms !== null)
        .map(([label, v]) => ({
          label,
          ms:  Math.round(v.ms),
          pct: Math.round((v.ms / totalMs) * 100),
        }))
        .sort((a, b) => b.ms - a.ms);
      return { total: Math.round(totalMs), segments: segs };
    },
  };

  res.on('finish', () => {
    const { total, segments: segs } = req.timer.summary();
    const route = req.route?.path || req.path;

    // Build X-Timing header
    const headerVal = segs.map(s => `${s.label}=${s.ms}ms(${s.pct}%)`).join(', ');
    if (!res.headersSent) {
      try { res.setHeader('X-Timing', headerVal); } catch {}
    }

    // Bottleneck warning
    const top = segs[0];
    if (top && top.pct >= 80 && total >= 200) {
      console.warn(`[BOTTLENECK] ${req.method} ${route} — ${top.label}=${top.ms}ms(${top.pct}%) of ${total}ms total`);
    }

    // Store in history for /internal/timing-report
    history.push({ route, method: req.method, total, segments: segs, ts: Date.now() });
    if (history.length > MAX_HISTORY) history.shift();
  });

  // Run next in request AsyncLocalStorage context
  timingContext.run(req, () => {
    next();
  });
}

// /internal/timing-report controller
export function timingReport(req, res) {
  const byRoute = {};

  for (const entry of history) {
    const key = `${entry.method} ${entry.route}`;
    if (!byRoute[key]) byRoute[key] = { key, latencies: [], bottlenecks: {} };
    byRoute[key].latencies.push(entry.total);

    const top = entry.segments[0];
    if (top) {
      byRoute[key].bottlenecks[top.label] = (byRoute[key].bottlenecks[top.label] || 0) + 1;
    }
  }

  const report = Object.values(byRoute).map(({ key, latencies, bottlenecks }) => {
    const sorted = [...latencies].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.floor(sorted.length * p)] ?? 0;
    return {
      route:     key,
      requests:  latencies.length,
      p50:       pct(0.50),
      p95:       pct(0.95),
      p99:       pct(0.99),
      over500ms: latencies.filter(l => l > 500).length,
      topBottleneck: Object.entries(bottlenecks).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
    };
  }).sort((a, b) => b.p99 - a.p99);

  res.json({ generated: new Date().toISOString(), routes: report });
}
