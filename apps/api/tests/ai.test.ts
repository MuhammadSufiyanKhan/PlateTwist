import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setAiProvider } from '../src/ai/index.js';
import type { AiInput, AiProvider } from '../src/ai/types.js';
import { validateSuggestions } from '../src/ai/validate.js';
import { config } from '../src/config.js';
import { costPerPortion, marginPct, suggestedPrice } from '../src/lib/calc.js';
import { AiUsage, Batch } from '../src/models/index.js';
import { app, auth, makeBatch, makeIngredient, makeWorld, resetDb, type World } from './helpers.js';

const allowed = new Map([
  ['a', { isStaple: false, name: 'Alpha' }],
  ['s', { isStaple: true, name: 'Salt' }],
]);
const ctx = { allowed, maxPortions: () => 5 };

describe('validateSuggestions', () => {
  const one = (items: { ingredientId: string; qtyPerPortion: number }[], extra = {}) => ({
    suggestions: [{ name: 'Dish', description: 'Nice dish', items, ...extra }],
  });
  it('accepts a good suggestion', () => {
    const r = validateSuggestions(one([{ ingredientId: 'a', qtyPerPortion: 100 }]), ctx);
    expect(r.valid).toHaveLength(1);
  });
  it('rejects unknown ingredient ids', () => {
    const r = validateSuggestions(one([{ ingredientId: 'zzz', qtyPerPortion: 100 }]), ctx);
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0]?.reason).toMatch(/unknown ingredient/);
  });
  it('rejects non-positive quantities', () => {
    for (const q of [0, -5, Number.NaN]) {
      const r = validateSuggestions(one([{ ingredientId: 'a', qtyPerPortion: q }]), ctx);
      expect(r.valid).toHaveLength(0);
    }
  });
  it('rejects suggestions that allow fewer than 2 portions', () => {
    const r = validateSuggestions(one([{ ingredientId: 'a', qtyPerPortion: 100 }]), {
      ...ctx,
      maxPortions: () => 1,
    });
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0]?.reason).toMatch(/portion/);
  });
  it('rejects suggestions with only staples', () => {
    const r = validateSuggestions(one([{ ingredientId: 's', qtyPerPortion: 5 }]), ctx);
    expect(r.valid).toHaveLength(0);
  });
  it('replaces descriptions that make health or allergen claims, and strips markup', () => {
    const r = validateSuggestions(
      one([{ ingredientId: 'a', qtyPerPortion: 100 }], {
        name: '<b>Dish</b>',
        description: 'A healthy gluten-free bowl',
      }),
      ctx,
    );
    expect(r.valid[0]?.description).toBe('A special made with Alpha.');
    expect(r.valid[0]?.name).not.toMatch(/[<>]/);
  });
});

describe('suggestions endpoint', () => {
  let w: World;
  let ids: Record<string, string>;
  beforeEach(async () => {
    await resetDb();
    w = await makeWorld('i');
    ids = {
      chicken: await makeIngredient(w.token, 'Chicken', 1.2),
      rice: await makeIngredient(w.token, 'Rice', 0.3),
      kale: await makeIngredient(w.token, 'Kale', 0.8),
      oil: await makeIngredient(w.token, 'Olive oil', 0.5, { baseUnit: 'ml', isStaple: true }),
    };
    await makeBatch(w.token, w.outletId, ids.chicken!, 2000, 1);
    await makeBatch(w.token, w.outletId, ids.rice!, 3000, 2);
    await makeBatch(w.token, w.outletId, ids.kale!, 800, 2);
  });
  afterEach(() => setAiProvider(null));

  const suggest = (token = w.staffToken, body: object = {}) =>
    request(app).post(`/api/v1/outlets/${w.outletId}/suggestions`).set(auth(token)).send(body);

  it('returns 3-5 cards whose numbers equal the calculator output', async () => {
    const r = await suggest();
    expect(r.status).toBe(200);
    expect(r.body.cards.length).toBeGreaterThanOrEqual(3);
    expect(r.body.cards.length).toBeLessThanOrEqual(5);
    const cost = new Map([
      [ids.chicken!, { costPerBaseUnit: 1.2, isStaple: false }],
      [ids.rice!, { costPerBaseUnit: 0.3, isStaple: false }],
      [ids.kale!, { costPerBaseUnit: 0.8, isStaple: false }],
      [ids.oil!, { costPerBaseUnit: 0.5, isStaple: true }],
    ]);
    for (const c of r.body.cards) {
      const cpp = costPerPortion(c.items, cost);
      expect(c.costPerPortion).toBe(cpp);
      expect(c.price).toBe(suggestedPrice(cpp, 70, 50));
      expect(c.marginPct).toBe(marginPct(c.price, cpp));
      expect(c.portions).toBeGreaterThanOrEqual(2);
      expect(c.savedValue).toBeGreaterThan(0);
    }
  });

  it('ignores AI-supplied numbers and drops invalid suggestions', async () => {
    const bad: AiProvider = {
      name: 'bad',
      suggestSpecials: async (_i: AiInput) => ({
        suggestions: [
          {
            name: 'Ghost',
            description: 'x',
            items: [{ ingredientId: 'deadbeef', qtyPerPortion: 10 }],
          },
          { name: 'Zero', description: 'x', items: [{ ingredientId: ids.rice, qtyPerPortion: 0 }] },
          {
            name: 'Huge',
            description: 'x',
            items: [{ ingredientId: ids.rice, qtyPerPortion: 99999 }],
          },
          {
            name: 'Fine',
            description: 'ok',
            price: 1,
            portions: 9999,
            items: [{ ingredientId: ids.rice, qtyPerPortion: 100 }],
          },
        ],
      }),
    };
    setAiProvider(bad);
    const r = await suggest();
    expect(r.status).toBe(200);
    expect(r.body.cards).toHaveLength(1);
    expect(r.body.cards[0].name).toBe('Fine');
    expect(r.body.cards[0].portions).toBe(30);
    expect(r.body.cards[0].price).not.toBe(1);
  });

  it('retries once on invalid output, then errors clearly', async () => {
    let calls = 0;
    setAiProvider({
      name: 'junk',
      suggestSpecials: async () => {
        calls++;
        return { nope: true };
      },
    });
    const r = await suggest();
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe('AI_INVALID_OUTPUT');
    expect(calls).toBe(2);

    calls = 0;
    setAiProvider({
      name: 'flaky',
      suggestSpecials: async () => {
        calls++;
        if (calls === 1) return 'garbage';
        return {
          suggestions: [
            {
              name: 'Ok',
              description: 'ok',
              items: [{ ingredientId: ids.rice, qtyPerPortion: 100 }],
            },
          ],
        };
      },
    });
    const r2 = await suggest();
    expect(r2.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('never sends expired stock to the AI', async () => {
    let seen: AiInput | null = null;
    await Batch.updateMany(
      { ingredientId: ids.chicken },
      { $set: { expiresOn: new Date(Date.now() - 2 * 86400000) } },
    );
    setAiProvider({
      name: 'spy',
      suggestSpecials: async (i) => {
        seen = i;
        return {
          suggestions: [
            {
              name: 'Ok',
              description: 'ok',
              items: [{ ingredientId: ids.rice, qtyPerPortion: 100 }],
            },
          ],
        };
      },
    });
    await suggest();
    const names = (seen as AiInput | null)?.atRisk.map((a) => a.name) ?? [];
    expect(names).not.toContain('Chicken');
    expect(names).toContain('Rice');
    expect((seen as AiInput | null)?.staples.map((s) => s.name)).toEqual(['Olive oil']);
  });

  it('enforces the per-brand daily cap', async () => {
    await AiUsage.create({
      brandId: w.brandId,
      day: new Date().toISOString().slice(0, 10),
      count: config.AI_DAILY_CAP_PER_BRAND,
    });
    expect((await suggest()).status).toBe(429);
  });

  it('runs a suggestion: creates and activates with server-computed numbers', async () => {
    const card = (await suggest()).body.cards[0];
    const r = await request(app)
      .post('/api/v1/specials')
      .set(auth(w.staffToken))
      .send({
        outletId: w.outletId,
        name: card.name,
        description: card.description,
        source: 'AI',
        activate: true,
        portionsPlanned: card.portions,
        items: card.items.map((i: { ingredientId: string; qtyPerPortion: number }) => ({
          ingredientId: i.ingredientId,
          qtyPerPortion: i.qtyPerPortion,
        })),
      });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('ACTIVE');
    expect(r.body.price).toBe(card.price);
    expect(r.body.costPerPortion).toBe(card.costPerPortion);
  });

  it('requires outlet access', async () => {
    expect((await suggest(w.staff2Token)).status).toBe(403);
  });
});
