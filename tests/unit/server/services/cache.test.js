import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern, withCache, flushL1Cache } from '../../../../server/src/services/cache.js';

describe('cache service (direct RDS connection)', () => {
  beforeEach(() => {
    flushL1Cache();
  });

  it('bypasses caching for standard query keys (returns null always)', async () => {
    const mockVal = { data: 'cached' };
    await cacheSet('verticals:list', mockVal, 300);
    const res = await cacheGet('verticals:list');
    expect(res).toBeNull();
  });

  it('allows caching specifically for csv_progress keys', async () => {
    const mockVal = { progress: 50 };
    await cacheSet('csv_progress:batch-123', mockVal, 300);
    const res = await cacheGet('csv_progress:batch-123');
    expect(res).toEqual(mockVal);
  });

  it('always bypasses cache-aside query wrapper and runs fetcher directly without caching', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
    const result = await withCache('verticals:list', 300, fetcher);

    expect(result).toEqual({ data: 'fresh' });
    expect(fetcher).toHaveBeenCalledOnce();

    const cachedVal = await cacheGet('verticals:list');
    expect(cachedVal).toBeNull();
  });

  it('supports deleting csv_progress keys', async () => {
    await cacheSet('csv_progress:batch-123', 'val1', 300);
    await cacheDelete('csv_progress:batch-123');
    const res = await cacheGet('csv_progress:batch-123');
    expect(res).toBeNull();
  });
});

