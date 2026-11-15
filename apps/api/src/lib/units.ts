export type BaseUnit = 'g' | 'ml' | 'pcs';
export const UNITS = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  pcs: { base: 'pcs', factor: 1 },
  dozen: { base: 'pcs', factor: 12 },
} as const;
export type Unit = keyof typeof UNITS;
export const UNIT_KEYS = Object.keys(UNITS) as [Unit, ...Unit[]];

export const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Convert a quantity in `unit` to the ingredient's base unit. Throws on incompatible units. */
export function toBaseUnits(qty: number, unit: Unit, baseUnit: BaseUnit): number {
  const u = UNITS[unit];
  if (u.base !== baseUnit) throw new Error(`Unit ${unit} is not compatible with ${baseUnit}`);
  return round3(qty * u.factor);
}

export function unitsFor(baseUnit: BaseUnit): Unit[] {
  return UNIT_KEYS.filter((k) => UNITS[k].base === baseUnit);
}
