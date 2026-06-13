import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp } from '../../../../server/src/controllers/followUps.js';
import { query } from '../../../../server/src/config/db.js';
import { mockRequest, mockResponse } from '../../../helpers/httpMocks.js';

vi.mock('../../../../server/src/config/db.js', () => ({
  query: vi.fn(),
  default: {
    query: vi.fn()
  }
}));

vi.mock('../../../../server/src/services/cache.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  cacheDelete: vi.fn(),
  cacheDeletePattern: vi.fn(),
}));

describe('followUpsController.createFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a follow up successfully', async () => {
    const mockFollowUp = { id: 'fu-1', description: 'Initial contact' };
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ sub_vertical_id: 'sv-1', vertical_id: 'vert-1', assigned_to: 'agent-1' }] }) // fetch lead
      .mockResolvedValueOnce({ rows: [mockFollowUp] }); // insert follow_up

    const req = mockRequest({
      user: { sub: 'admin-1', role: 'super_admin' },
      params: { leadId: 'lead-1' },
      body: {
        assignedToId: 'agent-1',
        followUpDate: '2026-06-20T10:00:00.000Z',
        description: 'Initial contact',
        status: 'PENDING'
      }
    });
    const res = mockResponse();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockFollowUp })
    );
  });
});
