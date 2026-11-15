import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, makeIngredient, makeWorld, resetDb, type World } from './helpers.js';

describe('demo data loader', () => {
  let w: World;
  beforeEach(async () => {
    await resetDb();
    w = await makeWorld('m');
  });

  it('fills an empty brand once and shows it on the dashboard', async () => {
    const r = await request(app).post('/api/v1/demo-data').set(auth(w.token));
    expect(r.status).toBe(201);
    const d = await request(app).get('/api/v1/dashboard').set(auth(w.token));
    expect(d.body.last30.saved).toBeGreaterThan(0);
    expect(d.body.atRisk.length).toBeGreaterThan(3);
    expect(d.body.activeSpecials.length).toBe(1);
    const again = await request(app).post('/api/v1/demo-data').set(auth(w.token));
    expect(again.status).toBe(409);
  });

  it('refuses when the brand already has ingredients, and for staff', async () => {
    await makeIngredient(w.token, 'Mine', 1);
    expect((await request(app).post('/api/v1/demo-data').set(auth(w.token))).status).toBe(409);
    expect((await request(app).post('/api/v1/demo-data').set(auth(w.staffToken))).status).toBe(403);
  });

  it("does not touch another brand's data", async () => {
    const other = await makeWorld('n');
    await request(app).post('/api/v1/demo-data').set(auth(w.token));
    const d = await request(app).get('/api/v1/dashboard').set(auth(other.token));
    expect(d.body.last30.saved).toBe(0);
    expect(
      (await request(app).get('/api/v1/ingredients').set(auth(other.token))).body.items,
    ).toHaveLength(0);
  });
});
