import { round3 } from './units.js';

export interface CalcItem {
  ingredientId: string;
  qtyPerPortion: number;
}
export interface CalcIngredient {
  costPerBaseUnit: number;
  isStaple: boolean;
}

/** Cost of one portion in minor units (rounded). Staples are included. */
export function costPerPortion(
  items: CalcItem[],
  ingredients: Map<string, CalcIngredient>,
): number {
  let total = 0;
  for (const it of items) {
    const ing = ingredients.get(it.ingredientId);
    if (!ing) throw new Error(`Unknown ingredient ${it.ingredientId}`);
    total += it.qtyPerPortion * ing.costPerBaseUnit;
  }
  return Math.round(total);
}

/** Round `value` up to a multiple of `step` (step >= 1). */
export function roundUpTo(value: number, step: number): number {
  const s = Math.max(1, Math.floor(step));
  return Math.ceil(value / s - 1e-9) * s;
}

/** suggestedPrice = cost ÷ (1 − targetMargin%), rounded up to the brand's priceRounding. */
export function suggestedPrice(
  cost: number,
  targetMarginPct: number,
  priceRounding: number,
): number {
  const m = Math.min(Math.max(targetMarginPct, 0), 95) / 100;
  return roundUpTo(cost / (1 - m), priceRounding);
}

/** Margin % of a price over cost, one decimal. */
export function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

/**
 * Max portions = min over non-staple items of available ÷ qtyPerPortion (floored).
 * `available` is the total quantity in eligible batches per ingredient.
 * A special with no non-staple item cannot use up stock, so it yields 0.
 */
export function maxPortions(
  items: CalcItem[],
  ingredients: Map<string, CalcIngredient>,
  available: Map<string, number>,
): number {
  let min = Infinity;
  for (const it of items) {
    const ing = ingredients.get(it.ingredientId);
    if (!ing) throw new Error(`Unknown ingredient ${it.ingredientId}`);
    if (ing.isStaple) continue;
    const avail = available.get(it.ingredientId) ?? 0;
    min = Math.min(min, Math.floor(round3(avail / it.qtyPerPortion) + 1e-9));
  }
  return Number.isFinite(min) ? Math.max(min, 0) : 0;
}

/** Value (minor units) of non-staple stock used if `portions` are made. */
export function stockValueUsed(
  items: CalcItem[],
  ingredients: Map<string, CalcIngredient>,
  portions: number,
): number {
  let total = 0;
  for (const it of items) {
    const ing = ingredients.get(it.ingredientId);
    if (!ing || ing.isStaple) continue;
    total += it.qtyPerPortion * portions * ing.costPerBaseUnit;
  }
  return Math.round(total);
}
