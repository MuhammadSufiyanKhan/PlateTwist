export function makeMoney(currency: string) {
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  } catch {
    fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
  }
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  const div = 10 ** digits;
  return {
    format: (minor: number) => fmt.format(minor / div),
    toMinor: (major: number) => Math.round(major * div),
    toMajor: (minor: number) => minor / div,
    digits,
  };
}
export type Money = ReturnType<typeof makeMoney>;

export const pct = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${n.toFixed(1)}%`);

/** Pretty quantity from base units. */
export function qtyLabel(qty: number, unit: string): string {
  if (unit === 'g') return qty >= 1000 ? `${trim(qty / 1000)} kg` : `${trim(qty)} g`;
  if (unit === 'ml') return qty >= 1000 ? `${trim(qty / 1000)} l` : `${trim(qty)} ml`;
  return `${trim(qty)} pcs`;
}
const trim = (n: number): string => String(Math.round(n * 100) / 100);

export function daysLabel(days: number): string {
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function todayIso(offset = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const UNIT_OPTIONS: Record<'g' | 'ml' | 'pcs', ('g' | 'kg' | 'ml' | 'l' | 'pcs' | 'dozen')[]> = {
  g: ['g', 'kg'],
  ml: ['ml', 'l'],
  pcs: ['pcs', 'dozen'],
};
export const UNIT_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, pcs: 1, dozen: 12 } as const;
