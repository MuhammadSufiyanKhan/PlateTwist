import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, makeBatch, makeIngredient, makeWorld, resetDb, type World } from './helpers.js';

describe('auth, tenancy and roles', () => {
  let a: World;
  let b: World;
  beforeEach(async () => {
    await resetDb();
    a = await makeWorld('a');
    b = await makeWorld('b');
  });

  it('rejects missing/invalid tokens and wrong passwords', async () => {
    expect((await request(app).get('/api/v1/ingredients')).status).toBe(401);
    expect((await request(app).get('/api/v1/ingredients').set(auth('bad'))).status).toBe(401);
    const r = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a-owner@test.io', password: 'nope-nope' });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates bodies with zod and the error envelope', async () => {
    const r = await request(app).post('/api/v1/auth/register').send({ email: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores a brandId sent by the client', async () => {
    const r = await request(app)
      .post('/api/v1/ingredients')
      .set(auth(a.token))
      .send({ name: 'Leek', baseUnit: 'g', costPerBaseUnit: 1, brandId: b.brandId });
    expect(r.status).toBe(201);
    const listB = await request(app).get('/api/v1/ingredients').set(auth(b.token));
    expect(listB.body.items).toHaveLength(0);
    const listA = await request(app).get('/api/v1/ingredients').set(auth(a.token));
    expect(listA.body.items).toHaveLength(1);
  });

  it('returns 404 for brand B resources accessed by brand A', async () => {
    const ingB = await makeIngredient(b.token, 'Secret', 2);
    const batchB = await makeBatch(b.token, b.outletId, ingB, 500, 2);
    expect(batchB.status).toBe(201);
    expect(
      (
        await request(app)
          .patch(`/api/v1/ingredients/${ingB}`)
          .set(auth(a.token))
          .send({ name: 'x' })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/ingredients/${ingB}`).set(auth(a.token))).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/outlets/${b.outletId}/at-risk`).set(auth(a.token))).status,
    ).toBe(404);
    expect((await makeBatch(a.token, b.outletId, ingB, 100, 2)).status).toBe(404);
    const ingA = await makeIngredient(a.token, 'Mine', 2);
    expect((await makeBatch(a.token, a.outletId, ingB, 100, 2)).status).toBe(404);
    const dish = await request(app)
      .post('/api/v1/dishes')
      .set(auth(a.token))
      .send({
        name: 'Bad',
        price: 100,
        recipe: [{ ingredientId: ingB, qty: 10 }],
      });
    expect(dish.status).toBe(400);
    const sp = await request(app)
      .post('/api/v1/specials')
      .set(auth(a.token))
      .send({
        outletId: b.outletId,
        name: 'x',
        items: [{ ingredientId: ingA, qtyPerPortion: 10 }],
      });
    expect(sp.status).toBe(404);
  });

  it('keeps staff inside their own outlets', async () => {
    const ing = await makeIngredient(a.token, 'Kale', 2);
    expect((await makeBatch(a.staffToken, a.outletId, ing, 100, 2)).status).toBe(201);
    const other = await makeBatch(a.staffToken, a.outlet2Id, ing, 100, 2);
    expect(other.status).toBe(403);
    expect(
      (await request(app).get(`/api/v1/outlets/${a.outlet2Id}/at-risk`).set(auth(a.staffToken)))
        .status,
    ).toBe(403);
    const outlets = await request(app).get('/api/v1/outlets').set(auth(a.staffToken));
    expect(outlets.body.items).toHaveLength(1);
    const ownerOutlets = await request(app).get('/api/v1/outlets').set(auth(a.token));
    expect(ownerOutlets.body.items).toHaveLength(2);
  });

  it('restricts owner-only routes to owners', async () => {
    const st = a.staffToken;
    expect(
      (
        await request(app)
          .post('/api/v1/ingredients')
          .set(auth(st))
          .send({ name: 'x', baseUnit: 'g', costPerBaseUnit: 1 })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/users')
          .set(auth(st))
          .send({ email: 'z@z.io', password: 'password123', outletIds: [a.outletId] })
      ).status,
    ).toBe(403);
    expect((await request(app).get('/api/v1/users').set(auth(st))).status).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/dishes')
          .set(auth(st))
          .send({ name: 'x', price: 1, recipe: [] })
      ).status,
    ).toBe(403);
    expect(
      (await request(app).patch('/api/v1/brand').set(auth(st)).send({ name: 'Hack' })).status,
    ).toBe(403);
    expect((await request(app).get('/api/v1/ingredients').set(auth(st))).status).toBe(200);
  });

  it('invites staff only into own-brand outlets', async () => {
    const r = await request(app)
      .post('/api/v1/users')
      .set(auth(a.token))
      .send({
        email: 'new@test.io',
        password: 'password123',
        outletIds: [b.outletId],
      });
    expect(r.status).toBe(400);
  });

  it('paginates lists with limit and cursor', async () => {
    for (const n of ['A', 'B', 'C']) await makeIngredient(a.token, n, 1);
    const p1 = await request(app).get('/api/v1/ingredients?limit=2').set(auth(a.token));
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await request(app)
      .get(`/api/v1/ingredients?limit=2&cursor=${p1.body.nextCursor}`)
      .set(auth(a.token));
    expect(p2.body.items).toHaveLength(1);
    expect(p2.body.nextCursor).toBeNull();
  });
});
