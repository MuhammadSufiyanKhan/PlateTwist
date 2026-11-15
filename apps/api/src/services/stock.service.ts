import type { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../errors.js';
import type { AuthUser } from '../middleware/core.js';
import {
  daysLeft,
  isEligible,
  isExpired,
  urgency,
  valueAtRisk,
  startOfUtcDay,
} from '../lib/risk.js';
import { round3, toBaseUnits, type Unit } from '../lib/units.js';
import {
  Batch,
  Ingredient,
  WasteEvent,
  type IBatch,
  type IBrand,
  type IIngredient,
} from '../models/index.js';
import { assertOutlet, getBrand } from './access.js';

/** Closes expired batches that still hold stock and writes WasteEvents. Idempotent. */
export async function sweepExpired(
  outletId: Types.ObjectId,
  brand: IBrand,
  now: Date = new Date(),
): Promise<number> {
  const candidates = await Batch.find({
    brandId: brand._id,
    outletId,
    status: 'ACTIVE',
    expiresOn: { $lt: startOfUtcDay(now) },
  }).lean();
  let swept = 0;
  for (const b of candidates) {
    if (isEligible(b, brand.allowBestBeforeExpired, now)) continue;
    // Atomic claim: only the caller that flips ACTIVE→CLOSED writes the waste event.
    const claimed = await Batch.findOneAndUpdate(
      { _id: b._id, status: 'ACTIVE' },
      { $set: { status: 'CLOSED', qtyRemaining: 0 } },
      { new: false },
    ).lean();
    if (!claimed) continue;
    swept++;
    if (claimed.qtyRemaining > 0) {
      const ing = await Ingredient.findById(b.ingredientId).lean();
      await WasteEvent.create({
        brandId: b.brandId,
        outletId,
        batchId: b._id,
        ingredientId: b.ingredientId,
        qty: claimed.qtyRemaining,
        valueMinor: Math.round(claimed.qtyRemaining * (ing?.costPerBaseUnit ?? 0)),
        reason: 'EXPIRED',
        date: b.expiresOn,
      });
    }
  }
  return swept;
}

export interface AtRiskRow {
  batchId: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  isStaple: boolean;
  qtyRemaining: number;
  qtyAllocated: number;
  expiresOn: string;
  dateType: string;
  daysLeft: number;
  urgency: string;
  valueAtRisk: number;
  stockValue: number;
}

/** Eligible, active, non-staple batches ranked by value at risk (desc). Sweeps first. */
export async function atRiskBoard(
  user: AuthUser,
  outletId: Types.ObjectId,
  now: Date = new Date(),
): Promise<AtRiskRow[]> {
  await assertOutlet(user, outletId);
  const brand = await getBrand(user.brandId);
  await sweepExpired(outletId, brand, now);
  const batches = await Batch.find({
    brandId: user.brandId,
    outletId,
    status: 'ACTIVE',
    qtyRemaining: { $gt: 0 },
  }).lean();
  const ings = await Ingredient.find({
    brandId: user.brandId,
    _id: { $in: batches.map((b) => b.ingredientId) },
  }).lean();
  const byId = new Map(ings.map((i) => [i._id.toString(), i]));
  const rows: AtRiskRow[] = [];
  for (const b of batches) {
    const ing = byId.get(b.ingredientId.toString());
    if (!ing || ing.isStaple || !isEligible(b, brand.allowBestBeforeExpired, now)) continue;
    const d = daysLeft(b.expiresOn, now);
    rows.push({
      batchId: b._id.toString(),
      ingredientId: ing._id.toString(),
      ingredientName: ing.name,
      baseUnit: ing.baseUnit,
      isStaple: ing.isStaple,
      qtyRemaining: b.qtyRemaining,
      qtyAllocated: b.qtyAllocated,
      expiresOn: b.expiresOn.toISOString().slice(0, 10),
      dateType: b.dateType,
      daysLeft: d,
      urgency: urgency(d),
      valueAtRisk: valueAtRisk(b.qtyRemaining, ing.costPerBaseUnit, d),
      stockValue: Math.round(b.qtyRemaining * ing.costPerBaseUnit),
    });
  }
  return rows.sort((a, b) => b.valueAtRisk - a.valueAtRisk);
}

export async function createBatch(
  user: AuthUser,
  input: {
    outletId: Types.ObjectId;
    ingredientId: Types.ObjectId;
    qty: number;
    unit: Unit;
    expiresOn: string;
    dateType: 'USE_BY' | 'BEST_BEFORE';
  },
): Promise<IBatch> {
  await assertOutlet(user, input.outletId);
  const ing = await Ingredient.findOne({ _id: input.ingredientId, brandId: user.brandId }).lean();
  if (!ing) throw notFound('Ingredient');
  let qty: number;
  try {
    qty = toBaseUnits(input.qty, input.unit, ing.baseUnit);
  } catch {
    throw badRequest(
      `Unit ${input.unit} cannot be used for ${ing.name} (base unit ${ing.baseUnit})`,
    );
  }
  const b = await Batch.create({
    brandId: user.brandId,
    outletId: input.outletId,
    ingredientId: ing._id,
    qtyRemaining: qty,
    expiresOn: new Date(`${input.expiresOn}T00:00:00.000Z`),
    dateType: input.dateType,
  });
  return b.toObject();
}

export async function logWaste(
  user: AuthUser,
  input: {
    outletId: Types.ObjectId;
    batchId: Types.ObjectId;
    qty: number;
    unit: Unit;
    reason: 'EXPIRED' | 'SPOILED' | 'OTHER';
  },
) {
  await assertOutlet(user, input.outletId);
  const batch = await Batch.findOne({
    _id: input.batchId,
    brandId: user.brandId,
    outletId: input.outletId,
  }).lean();
  if (!batch) throw notFound('Batch');
  const ing = (await Ingredient.findById(batch.ingredientId).lean()) as IIngredient;
  let qty: number;
  try {
    qty = toBaseUnits(input.qty, input.unit, ing.baseUnit);
  } catch {
    throw badRequest(`Unit ${input.unit} cannot be used for ${ing.name}`);
  }
  // Atomic: free stock must cover the waste quantity.
  const updated = await Batch.findOneAndUpdate(
    { _id: batch._id, status: 'ACTIVE', qtyRemaining: { $gte: qty } },
    { $inc: { qtyRemaining: -qty } },
    { new: true },
  ).lean();
  if (!updated) throw conflict('Not enough free stock in this batch', 'INSUFFICIENT_STOCK');
  if (round3(updated.qtyRemaining) <= 0 && updated.qtyAllocated <= 0)
    await Batch.updateOne({ _id: batch._id }, { $set: { status: 'CLOSED', qtyRemaining: 0 } });
  const ev = await WasteEvent.create({
    brandId: user.brandId,
    outletId: input.outletId,
    batchId: batch._id,
    ingredientId: batch.ingredientId,
    qty,
    valueMinor: Math.round(qty * ing.costPerBaseUnit),
    reason: input.reason,
    date: new Date(),
  });
  return ev.toObject();
}

export { isExpired };
