import { Types } from 'mongoose';
import { getAiProvider } from '../ai/index.js';
import { aiOutputSchema, type AiInput } from '../ai/types.js';
import { validateSuggestions, type ValidSuggestion } from '../ai/validate.js';
import { config } from '../config.js';
import { AppError, badRequest } from '../errors.js';
import { logger } from '../logger.js';
import type { AuthUser } from '../middleware/core.js';
import { maxPortions } from '../lib/calc.js';
import { AiUsage, Dish, Ingredient } from '../models/index.js';
import { getBrand } from './access.js';
import {
  availableByIngredient,
  calcMap,
  computeDraft,
  eligibleBatches,
} from './special.service.js';
import { atRiskBoard } from './stock.service.js';

async function takeDailySlot(brandId: Types.ObjectId): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const u = await AiUsage.findOneAndUpdate(
    { brandId, day },
    { $inc: { count: 1 } },
    { upsert: true, new: true },
  ).lean();
  if (u && u.count > config.AI_DAILY_CAP_PER_BRAND)
    throw new AppError(429, 'AI_DAILY_CAP', 'Daily AI suggestion limit reached for your brand');
}

export interface SuggestionCard extends ValidSuggestion {
  items: (ValidSuggestion['items'][number] & {
    name: string;
    baseUnit: string;
    isStaple: boolean;
  })[];
  portions: number;
  costPerPortion: number;
  price: number;
  marginPct: number;
  savedValue: number;
}

export async function suggestSpecials(
  user: AuthUser,
  outletId: Types.ObjectId,
  opts: { batchIds?: string[]; limit?: number } = {},
): Promise<{ cards: SuggestionCard[]; provider: string; basedOn: string[] }> {
  const board = await atRiskBoard(user, outletId); // asserts outlet, sweeps, excludes expired
  let rows = board;
  if (opts.batchIds && opts.batchIds.length > 0) {
    rows = board.filter((r) => opts.batchIds!.includes(r.batchId));
    if (rows.length === 0) throw badRequest('None of the selected batches are eligible');
  } else rows = board.slice(0, opts.limit ?? 5);
  if (rows.length === 0) throw badRequest('No eligible at-risk stock to build specials from');

  const brand = await getBrand(user.brandId);
  // Aggregate batches per ingredient (the AI works with ingredient ids).
  const agg = new Map<string, { name: string; unit: string; qty: number; days: number }>();
  for (const r of rows) {
    const e = agg.get(r.ingredientId);
    if (e) {
      e.qty += r.qtyRemaining;
      e.days = Math.min(e.days, r.daysLeft);
    } else
      agg.set(r.ingredientId, {
        name: r.ingredientName,
        unit: r.baseUnit,
        qty: r.qtyRemaining,
        days: r.daysLeft,
      });
  }
  const staples = await Ingredient.find({ brandId: user.brandId, isStaple: true }).lean();
  const dishes = await Dish.find({ brandId: user.brandId }).limit(30).lean();
  const ingNames = new Map(
    (await Ingredient.find({ brandId: user.brandId }).select('name').lean()).map((i) => [
      i._id.toString(),
      i.name,
    ]),
  );
  const input: AiInput = {
    atRisk: [...agg.entries()].map(([ingredientId, v]) => ({
      ingredientId,
      name: v.name,
      qty: Math.round(v.qty),
      unit: v.unit,
      daysLeft: v.days,
    })),
    staples: staples.map((s) => ({
      ingredientId: s._id.toString(),
      name: s.name,
      unit: s.baseUnit,
    })),
    catalog: dishes.map((d) => ({
      name: d.name,
      ingredients: d.recipe.map((r) => ingNames.get(r.ingredientId.toString()) ?? ''),
    })),
  };

  const allowedIds = [...agg.keys(), ...staples.map((s) => s._id.toString())];
  const ings = await Ingredient.find({ brandId: user.brandId, _id: { $in: allowedIds } }).lean();
  const map = calcMap(ings);
  const batches = await eligibleBatches(
    brand,
    outletId,
    ings.map((i) => i._id),
  );
  const available = availableByIngredient(batches);
  const allowed = new Map(
    ings.map((i) => [i._id.toString(), { isStaple: i.isStaple, name: i.name }]),
  );
  const ctx = {
    allowed,
    maxPortions: (items: ValidSuggestion['items']) => maxPortions(items, map, available),
  };

  await takeDailySlot(user.brandId);
  const provider = getAiProvider();
  let valid: ValidSuggestion[] = [];
  for (let attempt = 0; attempt < 2 && valid.length === 0; attempt++) {
    try {
      const raw = await provider.suggestSpecials(input);
      const parsed = aiOutputSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn({ attempt }, 'AI output failed schema validation');
        continue;
      }
      valid = validateSuggestions(parsed.data, ctx).valid.slice(0, 5);
    } catch (err) {
      logger.warn({ attempt, msg: err instanceof Error ? err.message : 'error' }, 'AI call failed');
    }
  }
  if (valid.length === 0)
    throw new AppError(
      502,
      'AI_INVALID_OUTPUT',
      'The AI did not return usable suggestions. Please try again.',
    );

  const cards: SuggestionCard[] = [];
  for (const s of valid) {
    const { computed } = await computeDraft(
      brand,
      outletId,
      s.items.map((i) => ({
        ingredientId: new Types.ObjectId(i.ingredientId),
        qtyPerPortion: i.qtyPerPortion,
      })),
    );
    cards.push({
      ...s,
      items: s.items.map((i) => ({
        ...i,
        name: allowed.get(i.ingredientId)?.name ?? '',
        baseUnit: ings.find((x) => x._id.toString() === i.ingredientId)?.baseUnit ?? 'g',
        isStaple: allowed.get(i.ingredientId)?.isStaple ?? false,
      })),
      portions: computed.maxPortions,
      costPerPortion: computed.costPerPortion,
      price: computed.price,
      marginPct: computed.marginPct,
      savedValue: computed.savedValueIfAll,
    });
  }
  return { cards, provider: provider.name, basedOn: rows.map((r) => r.batchId) };
}
