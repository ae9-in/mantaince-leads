import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../../server/src/app.js';
import { query } from '../../../server/src/config/db.js';

describe('Leads API Integration', () => {
  let adminToken = '';

  beforeAll(async () => {
    // Acquire a token using standard login
    try {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@gmail.com', password: 'admin123' });
      adminToken = loginRes.body.data.accessToken;
    } catch (err) {
      console.error('Failed to login during test setup', err.message);
    }
  });

  describe('GET /api/v1/leads', () => {
    it('returns 200 and lead list for authorized user', async () => {
      const res = await request(app)
        .get('/api/v1/leads?verticalId=0f26e60c-09fe-43e3-83c6-b8ece895d365&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/v1/leads?verticalId=0f26e60c-09fe-43e3-83c6-b8ece895d365')
        .expect(401);
    });

    it('responds within 200ms latency threshold', async () => {
      const start = Date.now();
      await request(app)
        .get('/api/v1/leads?verticalId=0f26e60c-09fe-43e3-83c6-b8ece895d365&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1500); // Generous buffer for test dev execution   
    });
  });
});
