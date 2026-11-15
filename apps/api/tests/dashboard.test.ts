import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Special, WasteEvent } from '../src/models/index.js';
import { app, auth, makeIngredient, makeWorld, resetDb, type World } from './helpers.js';

const day = (n: number) => new Date(Date.now() - n * 86400000);

describe('dashboard metrics', () => {
  let w: World;
  let ing: string;
  beforeEach(async () => {
    await resetDb();
    w = await makeWorld('d');
    ing = await makeIngredient(w.token, 'Beef', 2);
    const mk = (outletId: string, saved: number, endedDaysAgo: number, sold: number) =>
      Special.create({
        brandId: w.brandId,
        outletId,
        name: 's',
        items: [],
        portionsPlanned: 10,
        portionsSold: sold,
        costPerPortion: 200,
        price: 800,
        marginPct: 75,
        status: 'ENDED',
        source: 'CATALOG',
        savedValue: saved,
        endedAt: day(endedDaysAgo),
      });
    await mk(w.outletId, 600, 2, 3);
    await mk(w.outletId, 400, 20, 2);
    await mk(w.outlet2Id, 1000, 3, 5);
    const waste = (outletId: string, v: number, daysAgo: number) =>
      WasteEvent.create({
        brandId: w.brandId,
        outletId,
        ingredientId: ing,
        qty: v / 2,
        valueMinor: v,
        reason: 'EXPIRED',
        date: day(daysAgo),
      });
    await waste(w.outletId, 200, 1);
    await waste(w.outletId, 100, 25);
    await waste(w.outlet2Id, 1000, 4);
  });

  it('owner sees totals, windows, save rate per outlet and margin', async () => {
    const r = await request(app).get('/api/v1/dashboard').set(auth(w.token));
    expect(r.status).toBe(200);
    expect(r.body.last7.saved).toBe(1600);
    expect(r.body.last7.wasted).toBe(1200);
    expect(r.body.last7.saveRate).toBe(57.1);
    expect(r.body.last7.marginEarned).toBe((3 + 5) * 600);
    expect(r.body.last30.saved).toBe(2000);
    expect(r.body.last30.wasted).toBe(1300);
    expect(r.body.last30.saveRate).toBe(60.6);
    const o1 = r.body.last30.byOutlet.find((o: { outletId: string }) => o.outletId === w.outletId);
    expect(o1).toMatchObject({ saved: 1000, wasted: 300, saveRate: 76.9 });
    expect(r.body.topWasted[0]).toMatchObject({ name: 'Beef', valueWasted: 1300 });
    expect(r.body.trend.length).toBeGreaterThan(0);
  });

  it('staff only see their own outlet and cannot query another', async () => {
    const r = await request(app).get('/api/v1/dashboard').set(auth(w.staffToken));
    expect(r.body.last30.saved).toBe(1000);
    expect(r.body.last30.wasted).toBe(300);
    expect(r.body.outlets).toHaveLength(1);
    const x = await request(app)
      .get(`/api/v1/dashboard?outletId=${w.outlet2Id}`)
      .set(auth(w.staffToken));
    expect(x.status).toBe(403);
  });

  it('owner can filter to one outlet', async () => {
    const r = await request(app)
      .get(`/api/v1/dashboard?outletId=${w.outlet2Id}`)
      .set(auth(w.token));
    expect(r.body.last30.saved).toBe(1000);
    expect(r.body.last30.wasted).toBe(1000);
    expect(r.body.last30.saveRate).toBe(50);
  });
});
