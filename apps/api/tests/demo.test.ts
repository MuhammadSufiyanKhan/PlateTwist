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

  it('replace=true clears only this brand and reloads demo data', async () => {
    const other = await makeWorld('o');
    await makeIngredient(other.token, 'Keep me', 1);
    await makeIngredient(w.token, 'Old', 1);
    expect(
      (await request(app).post('/api/v1/demo-data?replace=true').set(auth(w.staffToken))).status,
    ).toBe(403);
    expect(
      (await request(app).post('/api/v1/demo-data?replace=true').set(auth(w.token))).status,
    ).toBe(201);
    const names = (
      await request(app).get('/api/v1/ingredients?limit=200').set(auth(w.token))
    ).body.items.map((i: { name: string }) => i.name);
    expect(names).not.toContain('Old');
    expect(names).toContain('Chicken thigh');
    const o = await request(app).get('/api/v1/ingredients').set(auth(other.token));
    expect(o.body.items.map((i: { name: string }) => i.name)).toEqual(['Keep me']);
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
