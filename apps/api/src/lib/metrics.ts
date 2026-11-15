export interface OutletAmount {
  outletId: string;
  amount: number;
}

/** save rate = saved ÷ (saved + wasted); null when there is nothing to measure. */
export function saveRate(saved: number, wasted: number): number | null {
  const total = saved + wasted;
  return total <= 0 ? null : Math.round((saved / total) * 1000) / 10;
}

export interface WindowSummary {
  saved: number;
  wasted: number;
  saveRate: number | null;
  marginEarned: number;
  byOutlet: { outletId: string; saved: number; wasted: number; saveRate: number | null }[];
}

export function summarize(
  saved: OutletAmount[],
  wasted: OutletAmount[],
  marginEarned: number,
): WindowSummary {
  const ids = new Set([...saved, ...wasted].map((r) => r.outletId));
  const sum = (rows: OutletAmount[], id: string) =>
    rows.filter((r) => r.outletId === id).reduce((a, r) => a + r.amount, 0);
  const byOutlet = [...ids].sort().map((outletId) => {
    const s = sum(saved, outletId);
    const w = sum(wasted, outletId);
    return { outletId, saved: s, wasted: w, saveRate: saveRate(s, w) };
  });
  const s = byOutlet.reduce((a, r) => a + r.saved, 0);
  const w = byOutlet.reduce((a, r) => a + r.wasted, 0);
  return { saved: s, wasted: w, saveRate: saveRate(s, w), marginEarned, byOutlet };
}

/** Merge weekly saved/wasted rows into one sorted trend series. */
export function mergeTrend(
  saved: { week: Date; amount: number }[],
  wasted: { week: Date; amount: number }[],
): { week: string; saved: number; wasted: number; saveRate: number | null }[] {
  const map = new Map<string, { saved: number; wasted: number }>();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  for (const r of saved) {
    const e = map.get(key(r.week)) ?? { saved: 0, wasted: 0 };
    e.saved += r.amount;
    map.set(key(r.week), e);
  }
  for (const r of wasted) {
    const e = map.get(key(r.week)) ?? { saved: 0, wasted: 0 };
    e.wasted += r.amount;
    map.set(key(r.week), e);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, ...v, saveRate: saveRate(v.saved, v.wasted) }));
}
