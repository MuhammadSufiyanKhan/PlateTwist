import { Types } from 'mongoose';
import { AppError, badRequest, conflict, notFound, unprocessable } from '../errors.js';
import type { AuthUser } from '../middleware/core.js';
import {
  costPerPortion,
  marginPct,
  maxPortions,
  stockValueUsed,
  suggestedPrice,
  type CalcIngredient,
  type CalcItem,
} from '../lib/calc.js';
import { isEligible, isExpired } from '../lib/risk.js';
import {
  Batch,
  Dish,
  Ingredient,
  Special,
  type IBatch,
  type IBrand,
  type IIngredient,
  type ISpecial,
} from '../models/index.js';
import { assertOutlet, getBrand } from './access.js';
import { sweepExpired } from './stock.service.js';

const EPS = 1e-6;

export interface SpecialItemInput {
  ingredientId: Types.ObjectId;
  qtyPerPortion: number;
}

/** Eligible batches (FEFO order) for the given ingredients at an outlet. */
export async function eligibleBatches(
  brand: IBrand,
  outletId: Types.ObjectId,
  ingredientIds: Types.ObjectId[],
  now: Date = new Date(),
): Promise<IBatch[]> {
  const batches = await Batch.find({
    brandId: brand._id,
    outletId,
    ingredientId: { $in: ingredientIds },
    status: 'ACTIVE',
    qtyRemaining: { $gt: 0 },
  })
    .sort({ expiresOn: 1, _id: 1 })
    .lean();
  return batches.filter((b) => isEligible(b, brand.allowBestBeforeExpired, now));
}

export function availableByIngredient(batches: IBatch[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of batches) {
    const k = b.ingredientId.toString();
    m.set(k, (m.get(k) ?? 0) + b.qtyRemaining);
  }
  return m;
}

export function calcMap(ings: IIngredient[]): Map<string, CalcIngredient> {
  return new Map(ings.map((i) => [i._id.toString(), i]));
}

export const toCalcItems = (items: SpecialItemInput[]): CalcItem[] =>
  items.map((i) => ({ ingredientId: i.ingredientId.toString(), qtyPerPortion: i.qtyPerPortion }));

function mergeItems(items: SpecialItemInput[]): SpecialItemInput[] {
  const m = new Map<string, SpecialItemInput>();
  for (const it of items) {
    const k = it.ingredientId.toString();
    const e = m.get(k);
    if (e) e.qtyPerPortion += it.qtyPerPortion;
    else m.set(k, { ...it });
  }
  return [...m.values()];
}

export interface Computed {
  costPerPortion: number;
  price: number;
  marginPct: number;
  maxPortions: number;
  savedValueIfAll: number;
}

/** All numbers for a draft, computed in code. */
export async function computeDraft(
  brand: IBrand,
  outletId: Types.ObjectId,
  items: SpecialItemInput[],
  now: Date = new Date(),
): Promise<{ computed: Computed; ingredients: IIngredient[] }> {
  const ids = items.map((i) => i.ingredientId);
  const ingredients = await Ingredient.find({ brandId: brand._id, _id: { $in: ids } }).lean();
  if (ingredients.length !== new Set(ids.map(String)).size)
    throw badRequest('Unknown ingredient in special');
  const map = calcMap(ingredients);
  const cItems = toCalcItems(items);
  const cost = costPerPortion(cItems, map);
  const price = suggestedPrice(cost, brand.targetMarginPct, brand.priceRounding);
  const batches = await eligibleBatches(brand, outletId, ids, now);
  const max = maxPortions(cItems, map, availableByIngredient(batches));
  return {
    ingredients,
    computed: {
      costPerPortion: cost,
      price,
      marginPct: marginPct(price, cost),
      maxPortions: max,
      savedValueIfAll: stockValueUsed(cItems, map, max),
    },
  };
}

export interface CreateSpecialInput {
  outletId: Types.ObjectId;
  name?: string;
  description?: string;
  items?: SpecialItemInput[];
  dishId?: Types.ObjectId;
  portionsPlanned?: number;
  price?: number;
  source: 'AI' | 'CATALOG';
}

export async function createSpecial(user: AuthUser, input: CreateSpecialInput): Promise<ISpecial> {
  await assertOutlet(user, input.outletId);
  const brand = await getBrand(user.brandId);
  let name = input.name;
  let items = input.items;
  if (input.dishId) {
    const dish = await Dish.findOne({ _id: input.dishId, brandId: user.brandId }).lean();
    if (!dish) throw notFound('Dish');
    name = name ?? dish.name;
    items = dish.recipe.map((r) => ({ ingredientId: r.ingredientId, qtyPerPortion: r.qty }));
  }
  if (!name || !items || items.length === 0)
    throw badRequest('A name and at least one item are required');
  items = mergeItems(items);
  if (items.some((i) => !(i.qtyPerPortion > 0))) throw badRequest('Quantities must be positive');
  await sweepExpired(input.outletId, brand);
  const { computed } = await computeDraft(brand, input.outletId, items);
  const planned = input.portionsPlanned ?? computed.maxPortions;
  if (!Number.isInteger(planned) || planned < 1)
    throw unprocessable('No portions can be made from the stock available', 'NO_STOCK');
  const price = input.price ?? computed.price;
  const s = await Special.create({
    brandId: user.brandId,
    outletId: input.outletId,
    name,
    description: input.description ?? '',
    items,
    portionsPlanned: planned,
    costPerPortion: computed.costPerPortion,
    price,
    marginPct: marginPct(price, computed.costPerPortion),
    status: 'SUGGESTED',
    source: input.source,
  });
  return s.toObject();
}

export interface ActivateHooks {
  /** Test hook: runs before each atomic allocation step. */
  onStep?: (index: number) => Promise<void>;
}

/** Activate: FEFO allocation with atomic conditional updates and compensating rollback. */
export async function activateSpecial(
  user: AuthUser,
  specialId: Types.ObjectId,
  hooks: ActivateHooks = {},
  now: Date = new Date(),
): Promise<ISpecial> {
  const special = await Special.findOne({ _id: specialId, brandId: user.brandId }).lean();
  if (!special) throw notFound('Special');
  await assertOutlet(user, special.outletId);
  if (special.status !== 'SUGGESTED')
    throw conflict('Only suggested specials can be activated', 'BAD_STATE');
  const brand = await getBrand(user.brandId);
  await sweepExpired(special.outletId, brand, now);

  const ids = special.items.map((i) => i.ingredientId);
  const ingredients = await Ingredient.find({ brandId: user.brandId, _id: { $in: ids } }).lean();
  const map = calcMap(ingredients);
  const batches = await eligibleBatches(brand, special.outletId, ids, now);
  const max = maxPortions(toCalcItems(special.items), map, availableByIngredient(batches));
  if (special.portionsPlanned > max)
    throw unprocessable(
      `Only ${max} portion(s) possible with eligible stock; ${special.portionsPlanned} planned`,
      'OVER_ALLOCATION',
      { maxPortions: max },
    );

  // Plan FEFO allocation.
  const plan: { batchId: Types.ObjectId; ingredientId: Types.ObjectId; qty: number }[] = [];
  for (const it of special.items) {
    if (map.get(it.ingredientId.toString())?.isStaple) continue;
    let need = it.qtyPerPortion * special.portionsPlanned;
    for (const b of batches.filter((x) => x.ingredientId.equals(it.ingredientId))) {
      if (need <= EPS) break;
      const take = Math.min(b.qtyRemaining, need);
      plan.push({ batchId: b._id, ingredientId: it.ingredientId, qty: take });
      need -= take;
    }
    if (need > EPS) throw unprocessable('Not enough eligible stock', 'OVER_ALLOCATION');
  }

  const applied: typeof plan = [];
  const rollback = async () => {
    for (const a of applied.reverse())
      await Batch.updateOne(
        { _id: a.batchId },
        { $inc: { qtyRemaining: a.qty, qtyAllocated: -a.qty } },
      );
  };
  try {
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i]!;
      if (hooks.onStep) await hooks.onStep(i);
      const r = await Batch.updateOne(
        {
          _id: step.batchId,
          brandId: user.brandId,
          status: 'ACTIVE',
          qtyRemaining: { $gte: step.qty },
        },
        { $inc: { qtyRemaining: -step.qty, qtyAllocated: step.qty } },
      );
      if (r.modifiedCount !== 1)
        throw conflict('Stock changed while activating; please retry', 'STOCK_CHANGED');
      applied.push(step);
    }
    const activated = await Special.findOneAndUpdate(
      { _id: specialId, brandId: user.brandId, status: 'SUGGESTED' },
      { $set: { status: 'ACTIVE', allocations: plan, startedAt: now } },
      { new: true },
    ).lean();
    if (!activated) throw conflict('Special was changed concurrently', 'BAD_STATE');
    return activated;
  } catch (e) {
    await rollback();
    throw e instanceof AppError ? e : e;
  }
}

/** Record one sale; never above planned portions. */
export async function recordSale(user: AuthUser, specialId: Types.ObjectId): Promise<ISpecial> {
  const s = await Special.findOne({ _id: specialId, brandId: user.brandId }).lean();
  if (!s) throw notFound('Special');
  await assertOutlet(user, s.outletId);
  const updated = await Special.findOneAndUpdate(
    {
      _id: specialId,
      brandId: user.brandId,
      status: 'ACTIVE',
      $expr: { $lt: ['$portionsSold', '$portionsPlanned'] },
    },
    { $inc: { portionsSold: 1 } },
    { new: true },
  ).lean();
  if (!updated)
    throw conflict(
      s.status !== 'ACTIVE' ? 'Special is not active' : 'All planned portions are already sold',
      'CANNOT_SELL',
    );
  return updated;
}

export interface EndSummary {
  special: ISpecial;
  portionsSold: number;
  portionsPlanned: number;
  savedValue: number;
  wastedValue: number;
  releasedValue: number;
  revenue: number;
  marginEarned: number;
}

/** End: release unsold allocation, then compute savedValue/wastedValue. Idempotent via state claim. */
export async function endSpecial(
  user: AuthUser,
  specialId: Types.ObjectId,
  now: Date = new Date(),
): Promise<EndSummary> {
  const found = await Special.findOne({ _id: specialId, brandId: user.brandId }).lean();
  if (!found) throw notFound('Special');
  await assertOutlet(user, found.outletId);
  const s = await Special.findOneAndUpdate(
    { _id: specialId, brandId: user.brandId, status: 'ACTIVE' },
    { $set: { status: 'ENDED', endedAt: now } },
    { new: true },
  ).lean();
  if (!s) throw conflict('Special is not active', 'BAD_STATE');

  const ings = await Ingredient.find({
    brandId: user.brandId,
    _id: { $in: s.items.map((i) => i.ingredientId) },
  }).lean();
  const cost = new Map(ings.map((i) => [i._id.toString(), i.costPerBaseUnit]));
  const batches = await Batch.find({ _id: { $in: s.allocations.map((a) => a.batchId) } }).lean();
  const batchById = new Map(batches.map((b) => [b._id.toString(), b]));

  let saved = 0;
  let released = 0;
  let wasted = 0;
  for (const it of s.items) {
    const allocs = s.allocations
      .filter((a) => a.ingredientId.equals(it.ingredientId))
      .sort(
        (a, b) =>
          (batchById.get(a.batchId.toString())?.expiresOn.getTime() ?? 0) -
          (batchById.get(b.batchId.toString())?.expiresOn.getTime() ?? 0),
      );
    let consumedLeft = it.qtyPerPortion * s.portionsSold;
    const unit = cost.get(it.ingredientId.toString()) ?? 0;
    for (const a of allocs) {
      const consumed = Math.min(a.qty, Math.max(consumedLeft, 0));
      consumedLeft -= consumed;
      const rel = a.qty - consumed;
      const after = await Batch.findOneAndUpdate(
        { _id: a.batchId },
        { $inc: { qtyAllocated: -a.qty, qtyRemaining: rel } },
        { new: true },
      ).lean();
      if (after && after.qtyRemaining <= EPS && after.qtyAllocated <= EPS)
        await Batch.updateOne(
          { _id: a.batchId },
          { $set: { status: 'CLOSED', qtyRemaining: 0, qtyAllocated: 0 } },
        );
      saved += consumed * unit;
      released += rel * unit;
      const b = batchById.get(a.batchId.toString());
      if (b && isExpired(b.expiresOn, now)) wasted += rel * unit;
    }
  }
  const savedValue = Math.round(saved);
  const wastedValue = Math.round(wasted);
  const final = await Special.findOneAndUpdate(
    { _id: specialId },
    { $set: { savedValue, wastedValue } },
    { new: true },
  ).lean();
  const revenue = s.portionsSold * s.price;
  return {
    special: final ?? s,
    portionsSold: s.portionsSold,
    portionsPlanned: s.portionsPlanned,
    savedValue,
    wastedValue,
    releasedValue: Math.round(released),
    revenue,
    marginEarned: revenue - s.portionsSold * s.costPerPortion,
  };
}

/** Present specials with ingredient names for the UI. */
export async function presentSpecials(brandId: Types.ObjectId, specials: ISpecial[]) {
  const ids = [...new Set(specials.flatMap((s) => s.items.map((i) => i.ingredientId.toString())))];
  const ings = await Ingredient.find({ brandId, _id: { $in: ids } }).lean();
  const byId = new Map(ings.map((i) => [i._id.toString(), i]));
  return specials.map((s) => ({
    id: s._id.toString(),
    outletId: s.outletId.toString(),
    name: s.name,
    description: s.description,
    status: s.status,
    source: s.source,
    portionsPlanned: s.portionsPlanned,
    portionsSold: s.portionsSold,
    costPerPortion: s.costPerPortion,
    price: s.price,
    marginPct: s.marginPct,
    savedValue: s.savedValue,
    wastedValue: s.wastedValue,
    startedAt: s.startedAt ?? null,
    endedAt: s.endedAt ?? null,
    createdAt: s.createdAt,
    items: s.items.map((i) => {
      const ing = byId.get(i.ingredientId.toString());
      return {
        ingredientId: i.ingredientId.toString(),
        name: ing?.name ?? 'Unknown',
        baseUnit: ing?.baseUnit ?? 'g',
        isStaple: ing?.isStaple ?? false,
        qtyPerPortion: i.qtyPerPortion,
      };
    }),
  }));
}
