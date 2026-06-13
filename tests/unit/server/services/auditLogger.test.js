import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAudit } from '../../../../server/src/services/audit.js';
import { query } from '../../../../server/src/config/db.js';
import { mockRequest } from '../../../helpers/httpMocks.js';

vi.mock('../../../../server/src/config/db.js', () => ({
  query: vi.fn(),
  default: {
    query: vi.fn()
  }
}));

describe('auditLogger.logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs asynchronously and logs successfully', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] });

    const req = mockRequest({
      user: { sub: 'u-1' },
      ip: '127.0.0.1'
    });

    logAudit(req, {
      action: 'LEAD_CREATED',
      targetCollection: 'leads',
      targetId: 'lead-1',
      before: null,
      after: { name: 'Acme' }
    });

    // Let the event queue flush so the async call executes
    await new Promise(resolve => setImmediate(resolve));

    expect(query).toHaveBeenCalled();
  });
});
