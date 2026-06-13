import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern, withCache } from '../../../../server/src/services/cache.js';
import { redis } from '../../../../server/src/lib/redis.js';

vi.mock('../../../../server/src/lib/redis.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  },
}));

describe('cache.withCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tries to call redis.get and returns the cached value', async () => {
    const mockVal = { data: 'cached' };
    vi.mocked(redis.get).mockResolvedValue(mockVal);
    const res = await cacheGet('test-key');
    expect(res).toEqual(mockVal);
  });

  it('runs fetcher on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
    const result = await withCache('test-key', 300, fetcher);

    expect(result).toEqual({ data: 'fresh' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
