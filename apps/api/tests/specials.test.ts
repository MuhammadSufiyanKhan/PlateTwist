import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { Batch, Special, WasteEvent } from '../src/models/index.js';
import { activateSpecial } from '../src/services/special.service.js';
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

describe('specials lifecycle', () => {
  let w: World;
  let chicken: string;
  let rice: string;
  let oil: string;
  beforeEach(async () => {
    await resetDb();
    w = await makeWorld('p');
    chicken = await makeIngredient(w.token, 'Chicken', 1.2);
    rice = await makeIngredient(w.token, 'Rice', 0.3);
    oil = await makeIngredient(w.token, 'Oil', 0.5, { isStaple: true });
  });

  const draft = (extra: Record<string, unknown> = {}) =>
    request(app)
      .post('/api/v1/specials')
      .set(auth(w.staffToken))
      .send({
        outletId: w.outletId,
        name: 'Chicken rice',
        items: [
          { ingredientId: chicken, qtyPerPortion: 150 },
          { ingredientId: rice, qtyPerPortion: 100 },
          { ingredientId: oil, qtyPerPortion: 10 },
        ],
        ...extra,
      });

  it('computes cost, price, margin and defaults portions to max', async () => {
    await makeBatch(w.token, w.outletId, chicken, 1000, 2); // 6 portions
    await makeBatch(w.token, w.outletId, rice, 450, 3); // 4 portions
    const r = await draft();
    expect(r.status).toBe(201);
    expect(r.body.costPerPortion).toBe(215);
    expect(r.body.price).toBe(750);
    expect(r.body.marginPct).toBe(71.3);
    expect(r.body.portionsPlanned).toBe(4);
    expect(r.body.status).toBe('SUGGESTED');
  });

  it('allocates FEFO across batches and keeps staples out of allocation', async () => {
    const late = await makeBatch(w.token, w.outletId, chicken, 600, 3);
    const soon = await makeBatch(w.token, w.outletId, chicken, 300, 1);
    await makeBatch(w.token, w.outletId, rice, 1000, 2);
    const d = await draft({ portionsPlanned: 5 }); // needs 750 chicken, 500 rice
    const a = await request(app)
      .post(`/api/v1/specials/${d.body.id}/activate`)
      .set(auth(w.staffToken));
    expect(a.status).toBe(200);
    expect(a.body.status).toBe('ACTIVE');
    const soonB = await Batch.findById(soon.body.id).lean();
    const lateB = await Batch.findById(late.body.id).lean();
    expect(soonB?.qtyRemaining).toBe(0); // earliest expiry drained first
    expect(soonB?.qtyAllocated).toBe(300);
    expect(lateB?.qtyRemaining).toBe(150);
    expect(lateB?.qtyAllocated).toBe(450);
    const sp = await Special.findById(d.body.id).lean();
    expect(sp?.allocations.some((x) => x.ingredientId.toString() === oil)).toBe(false);
    expect(sp?.allocations).toHaveLength(3);
  });

  it('rejects over-allocation and never touches stock', async () => {
    await makeBatch(w.token, w.outletId, chicken, 1000, 2);
    await makeBatch(w.token, w.outletId, rice, 450, 2);
    const d = await draft({ portionsPlanned: 5 });
    expect(d.status).toBe(201);
    const a = await request(app)
      .post(`/api/v1/specials/${d.body.id}/activate`)
      .set(auth(w.staffToken));
    expect(a.status).toBe(422);
    expect(a.body.error.code).toBe('OVER_ALLOCATION');
    expect((await Batch.find({ qtyAllocated: { $gt: 0 } })).length).toBe(0);
  });

  it('does not allocate expired stock', async () => {
    await insertBatch(w.brandId, w.outletId, chicken, 1000, -1, 'USE_BY');
    await makeBatch(w.token, w.outletId, rice, 450, 2);
    const d = await draft({ portionsPlanned: 2 });
    const a = await request(app)
      .post(`/api/v1/specials/${d.body.id}/activate`)
      .set(auth(w.staffToken));
    expect(a.status).toBe(422); // expired chicken is not eligible
    expect((await draft()).status).toBe(422); // and no portions can even be defaulted
    expect((await Batch.find({ qtyAllocated: { $gt: 0 } })).length).toBe(0);
  });

  it('rolls back earlier steps when a later atomic update fails', async () => {
    const b1 = await makeBatch(w.token, w.outletId, chicken, 1000, 1);
    const b2 = await makeBatch(w.token, w.outletId, rice, 1000, 2);
    const d = await draft({ portionsPlanned: 4 });
    const staff = {
      id: new Types.ObjectId(),
      brandId: new Types.ObjectId(w.brandId),
      role: 'OWNER' as const,
      outletIds: [],
    };
    await expect(
      activateSpecial(staff, new Types.ObjectId(d.body.id), {
        // Before the 2nd step, someone else takes the rice -> conditional update fails.
        onStep: async (i) => {
          if (i === 1) await Batch.updateOne({ _id: b2.body.id }, { $set: { qtyRemaining: 10 } });
        },
      }),
    ).rejects.toMatchObject({ code: 'STOCK_CHANGED' });
    const c = await Batch.findById(b1.body.id).lean();
    expect(c?.qtyRemaining).toBe(1000);
    expect(c?.qtyAllocated).toBe(0);
    const s = await Special.findById(d.body.id).lean();
    expect(s?.status).toBe('SUGGESTED');
    expect(s?.allocations).toHaveLength(0);
  });

  it('records sales up to planned and ends with saved value and released stock', async () => {
    const bc = await makeBatch(w.token, w.outletId, chicken, 600, 1);
    const br = await makeBatch(w.token, w.outletId, rice, 400, 1);
    const d = await draft({ portionsPlanned: 4, activate: true });
    expect(d.status).toBe(201);
    expect(d.body.status).toBe('ACTIVE');
    const id = d.body.id as string;
    for (let i = 0; i < 3; i++)
      expect(
        (await request(app).post(`/api/v1/specials/${id}/sold`).set(auth(w.staffToken))).status,
      ).toBe(200);
    const end = await request(app).post(`/api/v1/specials/${id}/end`).set(auth(w.staffToken));
    expect(end.status).toBe(200);
    // 3 sold: chicken 450g*1.2=540 + rice 300g*0.3=90 = 630
    expect(end.body.savedValue).toBe(630);
    // released: chicken 150g*1.2=180 + rice 100g*.3=30
    expect(end.body.releasedValue).toBe(210);
    expect(end.body.wastedValue).toBe(0);
    expect(end.body.revenue).toBe(3 * 750);
    expect(end.body.marginEarned).toBe(3 * (750 - 215));
    const c = await Batch.findById(bc.body.id).lean();
    const r = await Batch.findById(br.body.id).lean();
    expect(c?.qtyRemaining).toBe(150);
    expect(c?.qtyAllocated).toBe(0);
    expect(r?.qtyRemaining).toBe(100);
    // Ending twice is rejected.
    expect(
      (await request(app).post(`/api/v1/specials/${id}/end`).set(auth(w.staffToken))).status,
    ).toBe(409);
  });

  it('never sells above planned portions', async () => {
    await makeBatch(w.token, w.outletId, chicken, 300, 1);
    await makeBatch(w.token, w.outletId, rice, 200, 1);
    const d = await draft({ portionsPlanned: 2, activate: true });
    const id = d.body.id as string;
    await request(app).post(`/api/v1/specials/${id}/sold`).set(auth(w.staffToken));
    await request(app).post(`/api/v1/specials/${id}/sold`).set(auth(w.staffToken));
    const third = await request(app).post(`/api/v1/specials/${id}/sold`).set(auth(w.staffToken));
    expect(third.status).toBe(409);
    expect((await Special.findById(id).lean())?.portionsSold).toBe(2);
  });

  it('closes a fully used batch and does not double-allocate concurrently', async () => {
    await makeBatch(w.token, w.outletId, chicken, 300, 1);
    await makeBatch(w.token, w.outletId, rice, 200, 1);
    const a = await draft({ portionsPlanned: 2 });
    const b = await draft({ portionsPlanned: 2 });
    const [ra, rb] = await Promise.all([
      request(app).post(`/api/v1/specials/${a.body.id}/activate`).set(auth(w.staffToken)),
      request(app).post(`/api/v1/specials/${b.body.id}/activate`).set(auth(w.staffToken)),
    ]);
    expect([ra.status, rb.status].filter((c) => c === 200)).toHaveLength(1);
    const batches = await Batch.find({}).lean();
    for (const x of batches) expect(x.qtyRemaining).toBeGreaterThanOrEqual(0);
    expect(batches.reduce((s, x) => s + x.qtyAllocated, 0)).toBe(500);
  });

  it('creates a special from a catalog dish', async () => {
    await makeBatch(w.token, w.outletId, chicken, 600, 2);
    await makeBatch(w.token, w.outletId, rice, 600, 2);
    const dish = await request(app)
      .post('/api/v1/dishes')
      .set(auth(w.token))
      .send({
        name: 'Chicken plate',
        price: 1800,
        recipe: [
          { ingredientId: chicken, qty: 150 },
          { ingredientId: rice, qty: 100 },
        ],
      });
    const r = await request(app).post('/api/v1/specials').set(auth(w.staffToken)).send({
      outletId: w.outletId,
      dishId: dish.body.id,
      source: 'CATALOG',
      activate: true,
    });
    expect(r.status).toBe(201);
    expect(r.body.name).toBe('Chicken plate');
    expect(r.body.portionsPlanned).toBe(4);
  });

  it('wasted value counts released stock on expired batches', async () => {
    const bc = await makeBatch(w.token, w.outletId, chicken, 300, 1);
    await makeBatch(w.token, w.outletId, rice, 200, 1);
    const d = await draft({ portionsPlanned: 2, activate: true });
    await request(app).post(`/api/v1/specials/${d.body.id}/sold`).set(auth(w.staffToken));
    // Pretend the batch expired in the meantime, then end the special.
    await Batch.updateOne(
      { _id: bc.body.id },
      { $set: { expiresOn: new Date(Date.now() - 3 * 86400000) } },
    );
    const end = await request(app)
      .post(`/api/v1/specials/${d.body.id}/end`)
      .set(auth(w.staffToken));
    expect(end.body.wastedValue).toBe(180); // 150g chicken unsold × 1.2
    // The next at-risk load sweeps it into a real waste event.
    await request(app).get(`/api/v1/outlets/${w.outletId}/at-risk`).set(auth(w.staffToken));
    expect(await WasteEvent.countDocuments()).toBe(1);
  });
});
