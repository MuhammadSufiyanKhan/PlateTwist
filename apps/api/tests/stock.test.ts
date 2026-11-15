import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Batch, Brand, WasteEvent } from '../src/models/index.js';
import { sweepExpired } from '../src/services/stock.service.js';
import {
  app,
  auth,
  insertBatch,
  makeBatch,
  makeIngredient,
  makeWorld,
  resetDb,
  type World,
} from './helpers.js';
import { Types } from 'mongoose';

describe('stock and at-risk board', () => {
  let w: World;
  beforeEach(async () => {
    await resetDb();
    w = await makeWorld('s');
  });

  it('converts units when logging a batch', async () => {
    const ing = await makeIngredient(w.token, 'Flour-ish', 1);
    const r = await makeBatch(w.staffToken, w.outletId, ing, 2.5, 3, 'USE_BY', 'kg');
    expect(r.status).toBe(201);
    expect(r.body.qtyRemaining).toBe(2500);
    const bad = await makeBatch(w.staffToken, w.outletId, ing, 1, 3, 'USE_BY', 'l');
    expect(bad.status).toBe(400);
  });

  it('ranks by valueAtRisk and shows urgency', async () => {
    const cheapBig = await makeIngredient(w.token, 'Rice', 0.3);
    const dearSmall = await makeIngredient(w.token, 'Salmon', 3);
    await makeBatch(w.token, w.outletId, cheapBig, 2000, 3); // 600/3 = 200
    await makeBatch(w.token, w.outletId, dearSmall, 500, 1); // 1500/1 = 1500
    const r = await request(app)
      .get(`/api/v1/outlets/${w.outletId}/at-risk`)
      .set(auth(w.staffToken));
    expect(r.status).toBe(200);
    expect(r.body.items.map((x: { ingredientName: string }) => x.ingredientName)).toEqual([
      'Salmon',
      'Rice',
    ]);
    expect(r.body.items[0].valueAtRisk).toBe(1500);
    expect(r.body.items[0].urgency).toBe('TOMORROW');
    expect(r.body.items[1].urgency).toBe('SOON');
  });

  it('sweepExpired closes expired USE_BY batches, writes waste once (idempotent)', async () => {
    const ing = await makeIngredient(w.token, 'Fish', 2);
    await insertBatch(w.brandId, w.outletId, ing, 300, -2, 'USE_BY');
    const brand = (await Brand.findById(w.brandId).lean())!;
    const oid = new Types.ObjectId(w.outletId);
    expect(await sweepExpired(oid, brand)).toBe(1);
    expect(await sweepExpired(oid, brand)).toBe(0);
    const ev = await WasteEvent.find({}).lean();
    expect(ev).toHaveLength(1);
    expect(ev[0]?.valueMinor).toBe(600);
    expect(ev[0]?.reason).toBe('EXPIRED');
    const b = await Batch.findOne({}).lean();
    expect(b?.status).toBe('CLOSED');
    expect(b?.qtyRemaining).toBe(0);
  });

  it('concurrent sweeps still write a single WasteEvent', async () => {
    const ing = await makeIngredient(w.token, 'Fish', 2);
    await insertBatch(w.brandId, w.outletId, ing, 300, -1, 'USE_BY');
    const brand = (await Brand.findById(w.brandId).lean())!;
    const oid = new Types.ObjectId(w.outletId);
    await Promise.all([
      sweepExpired(oid, brand),
      sweepExpired(oid, brand),
      sweepExpired(oid, brand),
    ]);
    expect(await WasteEvent.countDocuments()).toBe(1);
  });

  it('expired USE_BY is excluded from the board and becomes waste on load', async () => {
    const ing = await makeIngredient(w.token, 'Prawns', 4);
    await insertBatch(w.brandId, w.outletId, ing, 100, -1, 'USE_BY');
    const r = await request(app).get(`/api/v1/outlets/${w.outletId}/at-risk`).set(auth(w.token));
    expect(r.body.items).toHaveLength(0);
    expect(await WasteEvent.countDocuments()).toBe(1);
  });

  it('BEST_BEFORE past date is excluded by default and kept when the brand allows it', async () => {
    const ing = await makeIngredient(w.token, 'Pasta', 1);
    await insertBatch(w.brandId, w.outletId, ing, 100, -1, 'BEST_BEFORE');
    let r = await request(app).get(`/api/v1/outlets/${w.outletId}/at-risk`).set(auth(w.token));
    expect(r.body.items).toHaveLength(0);
    await resetDb();
    w = await makeWorld('s');
    const ing2 = await makeIngredient(w.token, 'Pasta', 1);
    await request(app)
      .patch('/api/v1/brand')
      .set(auth(w.token))
      .send({ allowBestBeforeExpired: true });
    await insertBatch(w.brandId, w.outletId, ing2, 100, -1, 'BEST_BEFORE');
    r = await request(app).get(`/api/v1/outlets/${w.outletId}/at-risk`).set(auth(w.token));
    expect(r.body.items).toHaveLength(1);
    expect(await WasteEvent.countDocuments()).toBe(0);
  });

  it('logs waste against free stock only', async () => {
    const ing = await makeIngredient(w.token, 'Herbs', 2);
    const b = await makeBatch(w.staffToken, w.outletId, ing, 100, 2);
    const ok = await request(app).post('/api/v1/waste').set(auth(w.staffToken)).send({
      outletId: w.outletId,
      batchId: b.body.id,
      qty: 40,
      unit: 'g',
      reason: 'SPOILED',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.valueMinor).toBe(80);
    const over = await request(app).post('/api/v1/waste').set(auth(w.staffToken)).send({
      outletId: w.outletId,
      batchId: b.body.id,
      qty: 61,
      unit: 'g',
      reason: 'OTHER',
    });
    expect(over.status).toBe(409);
  });
});
