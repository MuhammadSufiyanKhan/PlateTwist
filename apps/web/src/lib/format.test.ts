import { describe, expect, it } from 'vitest';
import { daysLabel, makeMoney, pct, qtyLabel } from './format';

describe('format', () => {
  it('formats money from minor units', () => {
    const m = makeMoney('USD');
    expect(m.format(1250)).toContain('12.50');
    expect(m.toMinor(12.5)).toBe(1250);
  });
  it('formats quantities, days and percentages', () => {
    expect(qtyLabel(2500, 'g')).toBe('2.5 kg');
    expect(qtyLabel(300, 'ml')).toBe('300 ml');
    expect(qtyLabel(12, 'pcs')).toBe('12 pcs');
    expect(daysLabel(0)).toBe('today');
    expect(daysLabel(3)).toBe('in 3 days');
    expect(pct(71.25)).toBe('71.3%');
    expect(pct(null)).toBe('—');
  });
});
