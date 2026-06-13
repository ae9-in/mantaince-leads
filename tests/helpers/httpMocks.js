import { vi } from 'vitest';

export function mockRequest(options = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: null,
    ...options,
  };
  return req;
}

export function mockResponse() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}
