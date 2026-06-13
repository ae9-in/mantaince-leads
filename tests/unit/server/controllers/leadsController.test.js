import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLeads, createLead, updateLead, deleteLead } from '../../../../server/src/controllers/leads.js';
import { query } from '../../../../server/src/config/db.js';
import { logAudit } from '../../../../server/src/services/audit.js';
import { mockRequest, mockResponse } from '../../../helpers/httpMocks.js';

vi.mock('../../../../server/src/config/db.js', () => ({
  query: vi.fn(),
  default: {
    query: vi.fn()
  }
}));

vi.mock('../../../../server/src/services/audit.js', () => ({
  logAudit: vi.fn(),
}));

vi.mock('../../../../server/src/services/cache.js', () => ({
  withCache: vi.fn((key, ttl, fn) => fn()),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  cacheDelete: vi.fn(),
  cacheDeletePattern: vi.fn(),
  invalidateOnLeadChange: vi.fn().mockResolvedValue(true),
  invalidateOnTaxonomyChange: vi.fn().mockResolvedValue(true),
}));

describe('leadsController.getLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns leads successfully for vertical', async () => {
    const mockRows = [
      { id: 'lead-1', name: 'James Smith', status: 'new', lead_type: 'CALL', created_at: new Date() }
    ];

    vi.mocked(query).mockResolvedValue({ rows: mockRows });

    const req = mockRequest({
      user: { sub: 'user-1', role: 'super_admin', verticalAccess: [] },
      query: { verticalId: '0f26e60c-09fe-43e3-83c6-b8ece895d365', limit: '10' }
    });
    const res = mockResponse();

    await getLeads(req, res);

    expect(query).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array)
      })
    );
  });

  it('blocks agent from accessing leads outside vertical access', async () => {
    // Both must be valid UUIDs but mismatching
    const req = mockRequest({
      user: { sub: 'agent-1', role: 'agent', verticalAccess: ['00000000-0000-0000-0000-000000000001'] },
      query: { verticalId: '00000000-0000-0000-0000-000000000002' }
    });
    const res = mockResponse();

    await getLeads(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Access forbidden') })
    );
  });
});

describe('leadsController.createLead', () => {
  it('creates lead and records audit log', async () => {
    const mockLead = { id: 'new-lead-id', name: 'Test Corp' };
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [mockLead] }) // insert lead via atomic dedup CTE
      .mockResolvedValueOnce({ rows: [] }); // custom fields checking query

    const req = mockRequest({
      user: { sub: 'admin-1', email: 'admin@test.com', role: 'super_admin' },
      body: {
        name: 'Test Corp',
        phone: '+15550100',
        verticalId: '0f26e60c-09fe-43e3-83c6-b8ece895d365',
        subVerticalId: '00000000-0000-0000-0000-000000000001',
        leadType: 'CALL',
        data: {}
      }
    });
    const res = mockResponse();

    await createLead(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logAudit).toHaveBeenCalled();
  });
});
