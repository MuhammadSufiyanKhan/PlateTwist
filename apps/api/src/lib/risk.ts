export const DAY_MS = 86_400_000;

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Whole days from today (UTC) to the expiry date. 0 = expires today, -1 = expired yesterday. */
export function daysLeft(expiresOn: Date, now: Date = new Date()): number {
  return Math.round((startOfUtcDay(expiresOn).getTime() - startOfUtcDay(now).getTime()) / DAY_MS);
}

/** valueAtRisk = qtyRemaining × costPerBaseUnit ÷ max(daysLeft, 0.5), in minor units (rounded). */
export function valueAtRisk(qtyRemaining: number, costPerBaseUnit: number, days: number): number {
  return Math.round((qtyRemaining * costPerBaseUnit) / Math.max(days, 0.5));
}

export type DateType = 'USE_BY' | 'BEST_BEFORE';

/** Expired = date has passed (expires today is still usable today). */
export function isExpired(expiresOn: Date, now: Date = new Date()): boolean {
  return daysLeft(expiresOn, now) < 0;
}

/** Whether a batch may be offered to the AI or allocated to a special. */
export function isEligible(
  b: { expiresOn: Date; dateType: DateType },
  allowBestBeforeExpired: boolean,
  now: Date = new Date(),
): boolean {
  if (!isExpired(b.expiresOn, now)) return true;
  return b.dateType === 'BEST_BEFORE' && allowBestBeforeExpired;
}

export type Urgency = 'TODAY' | 'TOMORROW' | 'SOON' | 'LATER';
export function urgency(days: number): Urgency {
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  if (days <= 3) return 'SOON';
  return 'LATER';
}
