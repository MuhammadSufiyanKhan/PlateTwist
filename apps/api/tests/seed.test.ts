import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { seedDemo, DEMO_PASSWORD, DEMO_USERS } from '../src/seed/seed.js';
import { Batch } from '../src/models/index.js';
import { app, auth } from './helpers.js';

describe('seed', () => {
  it('builds a demo whose save rate improves over time', async () => {
    await seedDemo();
    const login = async (email: string) =>
      (await request(app).post('/api/v1/auth/login').send({ email, password: DEMO_PASSWORD })).body
        .token as string;
    const owner = await login(DEMO_USERS.owner);
    const d = await request(app).get('/api/v1/dashboard').set(auth(owner));
    expect(d.status).toBe(200);
    const t = d.body.trend as { saveRate: number | null }[];
    expect(t.length).toBeGreaterThan(6);
    const first = t.slice(0, 3).reduce((a, x) => a + (x.saveRate ?? 0), 0) / 3;
    const last = t.slice(-3).reduce((a, x) => a + (x.saveRate ?? 0), 0) / 3;
    expect(last).toBeGreaterThan(first + 10);
    expect(d.body.activeSpecials).toHaveLength(1);
    expect(d.body.atRisk.length).toBeGreaterThan(5);
    expect(await Batch.countDocuments({ status: 'ACTIVE' })).toBe(12);
    // staff only see their outlet
    const staff = await login(DEMO_USERS.staffHarbour);
    const sd = await request(app).get('/api/v1/dashboard').set(auth(staff));
    expect(sd.body.outlets).toHaveLength(1);
    expect(sd.body.outlets[0].name).toBe('Harbour');
  });
});
