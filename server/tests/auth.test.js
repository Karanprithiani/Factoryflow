import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, request, resetDb, login, as, pool } from './helpers.js';

describe('authentication and role-based access', () => {
  beforeAll(resetDb);
  afterAll(() => pool.end());

  it('logs in with correct credentials and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'requester@factoryflow.dev', password: 'Demo@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('requester');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects a wrong password with the same message as an unknown user', async () => {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'requester@factoryflow.dev', password: 'wrong' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@factoryflow.dev', password: 'wrong' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('blocks requests without a token or with a bad token', async () => {
    expect((await request(app).get('/api/items')).status).toBe(401);
    expect((await request(app).get('/api/items').set('Authorization', 'Bearer junk')).status).toBe(401);
  });

  it('only admins can list or create users', async () => {
    const requester = await login('requester');
    const admin = await login('admin');
    expect((await request(app).get('/api/users').set(as(requester))).status).toBe(403);
    expect((await request(app).get('/api/users').set(as(admin))).status).toBe(200);
  });
});
