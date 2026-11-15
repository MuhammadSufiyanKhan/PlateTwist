import { z } from 'zod';
import { notFound } from '../errors.js';
import { parseId, validate, wrap } from '../middleware/core.js';
import { Special } from '../models/index.js';
import { assertOutlet, visibleOutletIds } from '../services/access.js';
import { pageQuery, paginate } from '../services/paginate.js';
import {
  activateSpecial,
  createSpecial,
  endSpecial,
  presentSpecials,
  recordSale,
} from '../services/special.service.js';
import { suggestSpecials } from '../services/suggest.service.js';

const oid = (what: string) => z.string().transform((s) => parseId(s, what));

export const list = wrap(async (req, res) => {
  const q = validate(
    pageQuery.extend({
      outletId: oid('Outlet').optional(),
      status: z.enum(['SUGGESTED', 'ACTIVE', 'ENDED']).optional(),
    }),
    req.query,
  );
  if (q.outletId) await assertOutlet(req.user, q.outletId);
  const outletIds = q.outletId ? [q.outletId] : await visibleOutletIds(req.user);
  const p = await paginate(
    Special,
    {
      brandId: req.user.brandId,
      outletId: { $in: outletIds },
      ...(q.status ? { status: q.status } : {}),
    },
    q,
    'desc',
  );
  res.json({ items: await presentSpecials(req.user.brandId, p.items), nextCursor: p.nextCursor });
});

export const getOne = wrap(async (req, res) => {
  const s = await Special.findOne({
    _id: parseId(req.params.id, 'Special'),
    brandId: req.user.brandId,
  }).lean();
  if (!s) throw notFound('Special');
  await assertOutlet(req.user, s.outletId);
  res.json((await presentSpecials(req.user.brandId, [s]))[0]);
});

const createBody = z.object({
  outletId: oid('Outlet'),
  dishId: oid('Dish').optional(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(400).optional(),
  items: z
    .array(z.object({ ingredientId: oid('Ingredient'), qtyPerPortion: z.number().positive() }))
    .min(1)
    .max(12)
    .optional(),
  portionsPlanned: z.number().int().min(1).max(500).optional(),
  price: z.number().int().min(0).optional(),
  source: z.enum(['AI', 'CATALOG']).default('CATALOG'),
  activate: z.boolean().default(false),
});

export const create = wrap(async (req, res) => {
  const { activate, ...body } = validate(createBody, req.body);
  let s = await createSpecial(req.user, body);
  if (activate) {
    try {
      s = await activateSpecial(req.user, s._id);
    } catch (e) {
      await Special.deleteOne({ _id: s._id, status: 'SUGGESTED' }); // don't leave a dangling draft
      throw e;
    }
  }
  res.status(201).json((await presentSpecials(req.user.brandId, [s]))[0]);
});

export const activate = wrap(async (req, res) => {
  const s = await activateSpecial(req.user, parseId(req.params.id, 'Special'));
  res.json((await presentSpecials(req.user.brandId, [s]))[0]);
});

export const sold = wrap(async (req, res) => {
  const s = await recordSale(req.user, parseId(req.params.id, 'Special'));
  res.json((await presentSpecials(req.user.brandId, [s]))[0]);
});

export const end = wrap(async (req, res) => {
  const r = await endSpecial(req.user, parseId(req.params.id, 'Special'));
  const { special, ...rest } = r;
  res.json({ ...rest, special: (await presentSpecials(req.user.brandId, [special]))[0] });
});

export const suggest = wrap(async (req, res) => {
  const outletId = parseId(req.params.outletId, 'Outlet');
  const body = validate(
    z.object({
      batchIds: z.array(z.string()).max(20).optional(),
      limit: z.number().int().min(1).max(10).optional(),
    }),
    req.body ?? {},
  );
  res.json(await suggestSpecials(req.user, outletId, body));
});
