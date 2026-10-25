import request from 'supertest';
import bcrypt from 'bcryptjs';

const findUserByEmail = jest.fn();

jest.mock('../../services/userService', () => ({
  ...jest.requireActual('../../services/userService'),
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
}));

import { createApp } from '../../app';

const basic = (email: string, password: string) =>
  `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;

describe('Swagger docs auth', () => {
  beforeEach(() => {
    findUserByEmail.mockReset();
  });

  it('challenges requests without credentials', async () => {
    const app = createApp();
    const response = await request(app).get('/docs.json');

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toContain('Basic');
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects unknown users', async () => {
    findUserByEmail.mockResolvedValue({ data: null, error: null });
    const app = createApp();
    const response = await request(app)
      .get('/docs/')
      .set('Authorization', basic('stranger@example.com', 'whatever'));

    expect(response.status).toBe(401);
  });

  it('rejects a wrong password', async () => {
    const hash = await bcrypt.hash('Correct@123', 4);
    findUserByEmail.mockResolvedValue({ data: { password: hash }, error: null });
    const app = createApp();
    const response = await request(app)
      .get('/docs.json')
      .set('Authorization', basic('user@example.com', 'Wrong@123'));

    expect(response.status).toBe(401);
  });

  it('serves docs to registered users', async () => {
    const hash = await bcrypt.hash('Correct@123', 4);
    findUserByEmail.mockResolvedValue({ data: { password: hash }, error: null });
    const app = createApp();
    const auth = basic('user@example.com', 'Correct@123');

    const json = await request(app).get('/docs.json').set('Authorization', auth);
    expect(json.status).toBe(200);
    expect(json.body).toHaveProperty('openapi');

    const ui = await request(app).get('/docs/').set('Authorization', auth);
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger');
  });
});
