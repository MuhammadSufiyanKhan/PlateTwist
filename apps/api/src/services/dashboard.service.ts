import type { Types } from 'mongoose';
import { mergeTrend, summarize, type WindowSummary } from '../lib/metrics.js';
import type { AuthUser } from '../middleware/core.js';
import { DAY_MS } from '../lib/risk.js';
import { Ingredient, Outlet, Special, WasteEvent } from '../models/index.js';
import { assertOutlet, getBrand, visibleOutletIds } from './access.js';
import { atRiskBoard, sweepExpired } from './stock.service.js';

interface Group {
  _id: Types.ObjectId;
  amount: number;
}

async function windowSummary(
  brandId: Types.ObjectId,
  outletIds: Types.ObjectId[],
  days: number,
  now: Date,
): Promise<WindowSummary> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const [saved, wasted, margin] = await Promise.all([
    Special.aggregate<Group>([
      {
        $match: {
          brandId,
          outletId: { $in: outletIds },
          status: 'ENDED',
          endedAt: { $gte: since, $lte: now },
        },
      },
      { $group: { _id: '$outletId', amount: { $sum: '$savedValue' } } },
    ]),
    WasteEvent.aggregate<Group>([
      { $match: { brandId, outletId: { $in: outletIds }, date: { $gte: since, $lte: now } } },
      { $group: { _id: '$outletId', amount: { $sum: '$valueMinor' } } },
    ]),
    Special.aggregate<{ _id: null; amount: number }>([
      {
        $match: {
          brandId,
          outletId: { $in: outletIds },
          status: 'ENDED',
          endedAt: { $gte: since, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          amount: {
            $sum: { $multiply: ['$portionsSold', { $subtract: ['$price', '$costPerPortion'] }] },
          },
        },
      },
    ]),
  ]);
  return summarize(
    saved.map((r) => ({ outletId: r._id.toString(), amount: r.amount })),
    wasted.map((r) => ({ outletId: r._id.toString(), amount: r.amount })),
    margin[0]?.amount ?? 0,
  );
}

export async function dashboard(
  user: AuthUser,
  outletFilter?: Types.ObjectId,
  now: Date = new Date(),
) {
  const brand = await getBrand(user.brandId);
  let outletIds: Types.ObjectId[];
  if (outletFilter) {
    await assertOutlet(user, outletFilter);
    outletIds = [outletFilter];
  } else outletIds = await visibleOutletIds(user);
  for (const id of outletIds) await sweepExpired(id, brand, now);

  const outlets = await Outlet.find({ brandId: user.brandId, _id: { $in: outletIds } }).lean();
  const [d7, d30] = await Promise.all([
    windowSummary(user.brandId, outletIds, 7, now),
    windowSummary(user.brandId, outletIds, 30, now),
  ]);
  const since = new Date(now.getTime() - 84 * DAY_MS);
  const [savedWeeks, wastedWeeks, topWasted, active] = await Promise.all([
    Special.aggregate<{ _id: Date; amount: number }>([
      {
        $match: {
          brandId: user.brandId,
          outletId: { $in: outletIds },
          status: 'ENDED',
          endedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$endedAt', unit: 'week', startOfWeek: 'monday' } },
          amount: { $sum: '$savedValue' },
        },
      },
    ]),
    WasteEvent.aggregate<{ _id: Date; amount: number }>([
      { $match: { brandId: user.brandId, outletId: { $in: outletIds }, date: { $gte: since } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$date', unit: 'week', startOfWeek: 'monday' } },
          amount: { $sum: '$valueMinor' },
        },
      },
    ]),
    WasteEvent.aggregate<{ _id: Types.ObjectId; amount: number; qty: number }>([
      {
        $match: {
          brandId: user.brandId,
          outletId: { $in: outletIds },
          date: { $gte: new Date(now.getTime() - 30 * DAY_MS) },
        },
      },
      { $group: { _id: '$ingredientId', amount: { $sum: '$valueMinor' }, qty: { $sum: '$qty' } } },
      { $sort: { amount: -1 } },
      { $limit: 5 },
    ]),
    Special.find({ brandId: user.brandId, outletId: { $in: outletIds }, status: 'ACTIVE' }).lean(),
  ]);
  const ingNames = new Map(
    (
      await Ingredient.find({ _id: { $in: topWasted.map((t) => t._id) } })
        .select('name baseUnit')
        .lean()
    ).map((i) => [i._id.toString(), i]),
  );
  const atRisk = (
    await Promise.all(
      outletIds.map(async (id) =>
        (await atRiskBoard(user, id, now)).map((r) => ({
          ...r,
          outletId: id.toString(),
        })),
      ),
    )
  )
    .flat()
    .sort((a, b) => b.valueAtRisk - a.valueAtRisk)
    .slice(0, 8);

  return {
    currency: brand.currency,
    outlets: outlets.map((o) => ({ id: o._id.toString(), name: o.name })),
    last7: d7,
    last30: d30,
    trend: mergeTrend(
      savedWeeks.map((r) => ({ week: r._id, amount: r.amount })),
      wastedWeeks.map((r) => ({ week: r._id, amount: r.amount })),
    ),
    topWasted: topWasted.map((t) => ({
      ingredientId: t._id.toString(),
      name: ingNames.get(t._id.toString())?.name ?? 'Unknown',
      baseUnit: ingNames.get(t._id.toString())?.baseUnit ?? 'g',
      valueWasted: t.amount,
      qty: Math.round(t.qty),
    })),
    activeSpecials: active.map((s) => ({
      id: s._id.toString(),
      outletId: s.outletId.toString(),
      name: s.name,
      portionsSold: s.portionsSold,
      portionsPlanned: s.portionsPlanned,
    })),
    atRisk,
  };
}
