import type { AiOutput } from './types.js';

export interface ValidItem {
  ingredientId: string;
  qtyPerPortion: number;
}
export interface ValidSuggestion {
  name: string;
  description: string;
  items: ValidItem[];
}
export interface Rejection {
  name: string;
  reason: string;
}

const CLAIMS =
  /(gluten|allerg|vegan|vegetarian|dairy[- ]free|nut[- ]free|healthy|health|diet|calorie|detox|immune|cure|superfood|nutrition)/i;

/** Strip markup/control characters; the UI also renders text only. */
export const cleanText = (s: string): string =>
  // eslint-disable-next-line no-control-regex
  s
    .replace(/[<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface ValidateCtx {
  /** ids the AI was allowed to use, with staple flag */
  allowed: Map<string, { isStaple: boolean; name: string }>;
  /** portions possible for these items from eligible stock (computed in code) */
  maxPortions: (items: ValidItem[]) => number;
  minPortions?: number;
}

/** Discards suggestions that reference unknown ids, have non-positive quantities, or allow < 2 portions. */
export function validateSuggestions(
  out: AiOutput,
  ctx: ValidateCtx,
): { valid: ValidSuggestion[]; rejected: Rejection[] } {
  const valid: ValidSuggestion[] = [];
  const rejected: Rejection[] = [];
  const min = ctx.minPortions ?? 2;
  for (const s of out.suggestions) {
    const name = cleanText(s.name);
    const reject = (reason: string) => rejected.push({ name: name || '(unnamed)', reason });
    if (!name) {
      reject('empty name');
      continue;
    }
    const merged = new Map<string, number>();
    let bad: string | null = null;
    for (const it of s.items) {
      if (!ctx.allowed.has(it.ingredientId)) bad = `unknown ingredient id ${it.ingredientId}`;
      else if (!Number.isFinite(it.qtyPerPortion) || it.qtyPerPortion <= 0)
        bad = 'non-positive quantity';
      else merged.set(it.ingredientId, (merged.get(it.ingredientId) ?? 0) + it.qtyPerPortion);
      if (bad) break;
    }
    if (bad) {
      reject(bad);
      continue;
    }
    const items = [...merged.entries()].map(([ingredientId, qtyPerPortion]) => ({
      ingredientId,
      qtyPerPortion: Math.round(qtyPerPortion * 1000) / 1000,
    }));
    if (!items.some((i) => !ctx.allowed.get(i.ingredientId)?.isStaple)) {
      reject('uses no at-risk ingredient');
      continue;
    }
    const portions = ctx.maxPortions(items);
    if (portions < min) {
      reject(`allows only ${portions} portion(s)`);
      continue;
    }
    let description = cleanText(s.description ?? '');
    if (!description || CLAIMS.test(description) || CLAIMS.test(name)) {
      const names = items
        .filter((i) => !ctx.allowed.get(i.ingredientId)?.isStaple)
        .map((i) => ctx.allowed.get(i.ingredientId)?.name ?? '');
      description = `A special made with ${names.join(' and ')}.`;
    }
    valid.push({ name, description: description.slice(0, 300), items });
  }
  return { valid, rejected };
}
