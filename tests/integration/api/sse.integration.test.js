import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import app from '../../../server/src/app.js';

describe('SSE Integration', () => {
  let adminToken = '';

  beforeAll(async () => {
    try {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@gmail.com', password: 'admin123' });
      adminToken = loginRes.body.data.accessToken;
    } catch (err) {
      console.error('Failed to login during setup', err.message);
    }
  });

  it('keeps connection alive and responds with event-stream headers', async () => {
    // 1. Start express app on an ephemeral port
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    // 2. Make the HTTP request using native http.get
    await new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: '/api/v1/assignments/stream',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      };

      const req = http.request(options, (res) => {
        try {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');
          expect(res.headers['connection']).toBe('keep-alive');
          expect(res.headers['cache-control']).toContain('no-cache');
          
          // Clean up: destroy client connection and close server
          req.destroy();
          server.close(() => {
            resolve();
          });
        } catch (err) {
          req.destroy();
          server.close(() => {
            reject(err);
          });
        }
      });

      req.on('error', (err) => {
        // Native request may throw an ECONNRESET when we destroy it, which we ignore
        if (err.code === 'ECONNRESET') {
          resolve();
          return;
        }
        server.close(() => {
          reject(err);
        });
      });

      req.end();
    });
  });
});
