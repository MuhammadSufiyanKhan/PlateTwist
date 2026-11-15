import { describe, expect, it } from 'vitest';
import { daysLeft, isEligible, urgency, valueAtRisk } from '../src/lib/risk.js';
import { toBaseUnits } from '../src/lib/units.js';
import {
  costPerPortion,
  marginPct,
  maxPortions,
  roundUpTo,
  suggestedPrice,
  stockValueUsed,
} from '../src/lib/calc.js';
import { saveRate, summarize, mergeTrend } from '../src/lib/metrics.js';

const now = new Date('2026-03-10T15:30:00Z');

describe('risk', () => {
  it('daysLeft counts whole UTC days', () => {
    expect(daysLeft(new Date('2026-03-10T00:00:00Z'), now)).toBe(0);
    expect(daysLeft(new Date('2026-03-11T00:00:00Z'), now)).toBe(1);
    expect(daysLeft(new Date('2026-03-13T00:00:00Z'), now)).toBe(3);
    expect(daysLeft(new Date('2026-03-09T00:00:00Z'), now)).toBe(-1);
  });
  it('valueAtRisk = qty × cost ÷ max(days, 0.5)', () => {
    expect(valueAtRisk(1000, 1, 2)).toBe(500);
    expect(valueAtRisk(1000, 1, 0)).toBe(2000); // floor of 0.5 days
    expect(valueAtRisk(1000, 1, -3)).toBe(2000);
    expect(valueAtRisk(500, 0.9, 3)).toBe(150);
  });
  it('urgency labels', () => {
    expect([0, 1, 2, 3, 4].map(urgency)).toEqual(['TODAY', 'TOMORROW', 'SOON', 'SOON', 'LATER']);
  });
  it('eligibility: expired USE_BY never; BEST_BEFORE only when allowed', () => {
    const past = new Date('2026-03-09T00:00:00Z');
    expect(isEligible({ expiresOn: past, dateType: 'USE_BY' }, true, now)).toBe(false);
    expect(isEligible({ expiresOn: past, dateType: 'BEST_BEFORE' }, false, now)).toBe(false);
    expect(isEligible({ expiresOn: past, dateType: 'BEST_BEFORE' }, true, now)).toBe(true);
    expect(
      isEligible({ expiresOn: new Date('2026-03-10T00:00:00Z'), dateType: 'USE_BY' }, false, now),
    ).toBe(true);
  });
});

describe('units', () => {
  it('converts to base units and rejects incompatible units', () => {
    expect(toBaseUnits(2.5, 'kg', 'g')).toBe(2500);
    expect(toBaseUnits(1.5, 'l', 'ml')).toBe(1500);
    expect(toBaseUnits(2, 'dozen', 'pcs')).toBe(24);
    expect(() => toBaseUnits(1, 'kg', 'ml')).toThrow();
  });
});

describe('calculators', () => {
  const ings = new Map([
    ['chicken', { costPerBaseUnit: 1.2, isStaple: false }],
    ['rice', { costPerBaseUnit: 0.3, isStaple: false }],
    ['oil', { costPerBaseUnit: 0.5, isStaple: true }],
  ]);
  const items = [
    { ingredientId: 'chicken', qtyPerPortion: 150 },
    { ingredientId: 'rice', qtyPerPortion: 100 },
    { ingredientId: 'oil', qtyPerPortion: 10 },
  ];
  it('costPerPortion includes staples', () => {
    expect(costPerPortion(items, ings)).toBe(215); // 180 + 30 + 5
  });
  it('roundUpTo', () => {
    expect(roundUpTo(1001, 50)).toBe(1050);
    expect(roundUpTo(1000, 50)).toBe(1000);
    expect(roundUpTo(7.2, 1)).toBe(8);
  });
  it('suggestedPrice = cost ÷ (1 − margin) rounded up', () => {
    expect(suggestedPrice(215, 70, 50)).toBe(750); // 716.67 -> 750
    expect(suggestedPrice(300, 70, 100)).toBe(1000); // 1000 exactly
    expect(suggestedPrice(100, 50, 1)).toBe(200);
  });
  it('marginPct', () => {
    expect(marginPct(750, 215)).toBe(71.3);
    expect(marginPct(0, 10)).toBe(0);
  });
  it('maxPortions uses only non-staples and the tightest item', () => {
    const avail = new Map([
      ['chicken', 1000],
      ['rice', 450],
    ]);
    expect(maxPortions(items, ings, avail)).toBe(4); // rice: 450/100 = 4.5
    expect(maxPortions([{ ingredientId: 'oil', qtyPerPortion: 1 }], ings, avail)).toBe(0);
    expect(maxPortions(items, ings, new Map())).toBe(0);
  });
  it('stockValueUsed counts non-staples only', () => {
    expect(stockValueUsed(items, ings, 4)).toBe(840); // (180+30)*4
  });
});

describe('metrics', () => {
  it('saveRate', () => {
    expect(saveRate(750, 250)).toBe(75);
    expect(saveRate(0, 0)).toBeNull();
    expect(saveRate(0, 100)).toBe(0);
  });
  it('summarize totals and per outlet', () => {
    const s = summarize(
      [
        { outletId: 'o1', amount: 600 },
        { outletId: 'o2', amount: 400 },
      ],
      [
        { outletId: 'o1', amount: 100 },
        { outletId: 'o2', amount: 400 },
      ],
      250,
    );
    expect(s.saved).toBe(1000);
    expect(s.wasted).toBe(500);
    expect(s.saveRate).toBe(66.7);
    expect(s.marginEarned).toBe(250);
    expect(s.byOutlet.find((o) => o.outletId === 'o1')?.saveRate).toBe(85.7);
    expect(s.byOutlet.find((o) => o.outletId === 'o2')?.saveRate).toBe(50);
  });
  it('mergeTrend sorts weeks', () => {
    const t = mergeTrend(
      [{ week: new Date('2026-03-09'), amount: 100 }],
      [
        { week: new Date('2026-03-02'), amount: 50 },
        { week: new Date('2026-03-09'), amount: 100 },
      ],
    );
    expect(t.map((x) => x.week)).toEqual(['2026-03-02', '2026-03-09']);
    expect(t[1]?.saveRate).toBe(50);
  });
});
