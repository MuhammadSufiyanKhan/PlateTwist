import { z } from 'zod';
import { UNIT_KEYS } from '../lib/units.js';
import { parseId, validate, wrap } from '../middleware/core.js';
import { Batch, Ingredient, WasteEvent } from '../models/index.js';
import { assertOutlet } from '../services/access.js';
import { pageQuery, paginate } from '../services/paginate.js';
import { atRiskBoard, createBatch, logWaste } from '../services/stock.service.js';

const oid = (what: string) => z.string().transform((s) => parseId(s, what));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const atRisk = wrap(async (req, res) => {
  const outletId = parseId(req.params.outletId, 'Outlet');
  res.json({ items: await atRiskBoard(req.user, outletId), nextCursor: null });
});

export const postBatch = wrap(async (req, res) => {
  const body = validate(
    z.object({
      outletId: oid('Outlet'),
      ingredientId: oid('Ingredient'),
      qty: z.number().positive().max(1_000_000),
      unit: z.enum(UNIT_KEYS),
      expiresOn: isoDate,
      dateType: z.enum(['USE_BY', 'BEST_BEFORE']),
    }),
    req.body,
  );
  const b = await createBatch(req.user, body);
  res.status(201).json({
    id: b._id.toString(),
    outletId: b.outletId.toString(),
    ingredientId: b.ingredientId.toString(),
    qtyRemaining: b.qtyRemaining,
    expiresOn: b.expiresOn.toISOString().slice(0, 10),
    dateType: b.dateType,
    status: b.status,
  });
});

export const listBatches = wrap(async (req, res) => {
  const q = validate(
    pageQuery.extend({ outletId: oid('Outlet'), status: z.enum(['ACTIVE', 'CLOSED']).optional() }),
    req.query,
  );
  await assertOutlet(req.user, q.outletId);
  const p = await paginate(
    Batch,
    { brandId: req.user.brandId, outletId: q.outletId, ...(q.status ? { status: q.status } : {}) },
    q,
    'desc',
  );
  const ings = await Ingredient.find({
    brandId: req.user.brandId,
    _id: { $in: p.items.map((b) => b.ingredientId) },
  }).lean();
  const names = new Map(ings.map((i) => [i._id.toString(), i]));
  res.json({
    items: p.items.map((b) => ({
      id: b._id.toString(),
      ingredientId: b.ingredientId.toString(),
      ingredientName: names.get(b.ingredientId.toString())?.name ?? 'Unknown',
      baseUnit: names.get(b.ingredientId.toString())?.baseUnit ?? 'g',
      qtyRemaining: b.qtyRemaining,
      qtyAllocated: b.qtyAllocated,
      expiresOn: b.expiresOn.toISOString().slice(0, 10),
      dateType: b.dateType,
      status: b.status,
    })),
    nextCursor: p.nextCursor,
  });
});

export const postWaste = wrap(async (req, res) => {
  const body = validate(
    z.object({
      outletId: oid('Outlet'),
      batchId: oid('Batch'),
      qty: z.number().positive().max(1_000_000),
      unit: z.enum(UNIT_KEYS),
      reason: z.enum(['EXPIRED', 'SPOILED', 'OTHER']),
    }),
    req.body,
  );
  const ev = await logWaste(req.user, body);
  res
    .status(201)
    .json({ id: ev._id.toString(), qty: ev.qty, valueMinor: ev.valueMinor, reason: ev.reason });
});

export const listWaste = wrap(async (req, res) => {
  const q = validate(pageQuery.extend({ outletId: oid('Outlet') }), req.query);
  await assertOutlet(req.user, q.outletId);
  const p = await paginate(
    WasteEvent,
    { brandId: req.user.brandId, outletId: q.outletId },
    q,
    'desc',
  );
  const ings = await Ingredient.find({
    brandId: req.user.brandId,
    _id: { $in: p.items.map((w) => w.ingredientId) },
  }).lean();
  const names = new Map(ings.map((i) => [i._id.toString(), i.name]));
  res.json({
    items: p.items.map((w) => ({
      id: w._id.toString(),
      ingredientName: names.get(w.ingredientId.toString()) ?? 'Unknown',
      qty: w.qty,
      valueMinor: w.valueMinor,
      reason: w.reason,
      date: w.date,
    })),
    nextCursor: p.nextCursor,
  });
});
