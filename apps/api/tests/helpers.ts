import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Batch, Ingredient } from '../src/models/index.js';

export const app = createApp();

export async function resetDb(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
}

export interface World {
  token: string;
  brandId: string;
  outletId: string;
  outlet2Id: string;
  staffToken: string;
  staff2Token: string;
}

export async function register(email: string, brandName = 'Test Brand') {
  const r = await request(app)
    .post('/api/v1/auth/register')
    .send({ brandName, currency: 'USD', email, password: 'password123' });
  return r.body as { token: string; user: { id: string; brandId: string; outletIds: string[] } };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Brand with owner, 2 outlets, staff1 (outlet1), staff2 (outlet2). */
export async function makeWorld(prefix = 'a'): Promise<World> {
  const owner = await register(`${prefix}-owner@test.io`, `Brand ${prefix}`);
  const o2 = await request(app)
    .post('/api/v1/outlets')
    .set(auth(owner.token))
    .send({ name: 'Second' });
  const outletId = owner.user.outletIds[0]!;
  const outlet2Id = o2.body.id as string;
  const s1 = await request(app)
    .post('/api/v1/users')
    .set(auth(owner.token))
    .send({
      email: `${prefix}-s1@test.io`,
      password: 'password123',
      outletIds: [outletId],
    });
  const s2 = await request(app)
    .post('/api/v1/users')
    .set(auth(owner.token))
    .send({
      email: `${prefix}-s2@test.io`,
      password: 'password123',
      outletIds: [outlet2Id],
    });
  void s1;
  void s2;
  const login = async (e: string) =>
    (await request(app).post('/api/v1/auth/login').send({ email: e, password: 'password123' })).body
      .token as string;
  return {
    token: owner.token,
    brandId: owner.user.brandId,
    outletId,
    outlet2Id,
    staffToken: await login(`${prefix}-s1@test.io`),
    staff2Token: await login(`${prefix}-s2@test.io`),
  };
}

export async function makeIngredient(
  token: string,
  name: string,
  cost: number,
  opts: { baseUnit?: 'g' | 'ml' | 'pcs'; isStaple?: boolean } = {},
): Promise<string> {
  const r = await request(app)
    .post('/api/v1/ingredients')
    .set(auth(token))
    .send({
      name,
      baseUnit: opts.baseUnit ?? 'g',
      costPerBaseUnit: cost,
      isStaple: opts.isStaple ?? false,
    });
  return r.body.id as string;
}

export function isoDay(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export async function makeBatch(
  token: string,
  outletId: string,
  ingredientId: string,
  qty: number,
  daysFromNow: number,
  dateType: 'USE_BY' | 'BEST_BEFORE' = 'USE_BY',
  unit = 'g',
) {
  const r = await request(app)
    .post('/api/v1/batches')
    .set(auth(token))
    .send({
      outletId,
      ingredientId,
      qty,
      unit,
      expiresOn: isoDay(daysFromNow),
      dateType,
    });
  return r;
}

/** Insert an already-expired batch directly (API refuses nothing, but stays explicit). */
export async function insertBatch(
  brandId: string,
  outletId: string,
  ingredientId: string,
  qty: number,
  daysFromNow: number,
  dateType: 'USE_BY' | 'BEST_BEFORE' = 'USE_BY',
) {
  const d = new Date(`${isoDay(daysFromNow)}T00:00:00.000Z`);
  return Batch.create({
    brandId,
    outletId,
    ingredientId,
    qtyRemaining: qty,
    expiresOn: d,
    dateType,
  });
}

export { Ingredient };
