import request from 'supertest';
import { createApp } from '../../app';

describe('GET /health', () => {
  it('responds with service status', async () => {
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
