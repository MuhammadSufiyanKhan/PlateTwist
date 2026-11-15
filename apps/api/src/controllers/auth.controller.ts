import { z } from 'zod';
import { notFound } from '../errors.js';
import { validate, wrap } from '../middleware/core.js';
import { Brand, Outlet, User } from '../models/index.js';
import { inviteStaff, login, publicUser, registerBrand } from '../services/auth.service.js';
import { pageQuery, paginate } from '../services/paginate.js';

const password = z.string().min(8).max(100);

export const register = wrap(async (req, res) => {
  const body = validate(
    z.object({
      brandName: z.string().trim().min(2).max(80),
      currency: z.string().trim().length(3).toUpperCase().default('USD'),
      email: z.string().email(),
      password,
    }),
    req.body,
  );
  res.status(201).json(await registerBrand(body));
});

export const loginCtl = wrap(async (req, res) => {
  const body = validate(
    z.object({ email: z.string().email(), password: z.string().min(1) }),
    req.body,
  );
  res.json(await login(body.email, body.password));
});

export const me = wrap(async (req, res) => {
  const u = await User.findById(req.user.id).lean();
  const brand = await Brand.findById(req.user.brandId).lean();
  if (!u || !brand) throw notFound('User');
  res.json({
    user: publicUser(u),
    brand: {
      id: brand._id.toString(),
      name: brand.name,
      currency: brand.currency,
      targetMarginPct: brand.targetMarginPct,
      priceRounding: brand.priceRounding,
      allowBestBeforeExpired: brand.allowBestBeforeExpired,
    },
  });
});

export const invite = wrap(async (req, res) => {
  const body = validate(
    z.object({ email: z.string().email(), password, outletIds: z.array(z.string()).min(1) }),
    req.body,
  );
  res.status(201).json(await inviteStaff(req.user.brandId, body));
});

export const listUsers = wrap(async (req, res) => {
  const q = validate(pageQuery, req.query);
  const page = await paginate(User, { brandId: req.user.brandId }, q);
  res.json({ items: page.items.map(publicUser), nextCursor: page.nextCursor });
});

export const patchBrand = wrap(async (req, res) => {
  const body = validate(
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      targetMarginPct: z.number().min(0).max(95).optional(),
      priceRounding: z.number().int().min(1).max(100000).optional(),
      allowBestBeforeExpired: z.boolean().optional(),
    }),
    req.body,
  );
  const b = await Brand.findByIdAndUpdate(req.user.brandId, { $set: body }, { new: true }).lean();
  if (!b) throw notFound('Brand');
  res.json({
    id: b._id.toString(),
    name: b.name,
    currency: b.currency,
    targetMarginPct: b.targetMarginPct,
    priceRounding: b.priceRounding,
    allowBestBeforeExpired: b.allowBestBeforeExpired,
  });
});

export const listOutlets = wrap(async (req, res) => {
  const filter =
    req.user.role === 'OWNER'
      ? { brandId: req.user.brandId }
      : { brandId: req.user.brandId, _id: { $in: req.user.outletIds } };
  const items = await Outlet.find(filter).sort({ name: 1 }).lean();
  res.json({ items: items.map((o) => ({ id: o._id.toString(), name: o.name })), nextCursor: null });
});

export const createOutlet = wrap(async (req, res) => {
  const body = validate(z.object({ name: z.string().trim().min(2).max(80) }), req.body);
  const o = await Outlet.create({ brandId: req.user.brandId, name: body.name });
  res.status(201).json({ id: o._id.toString(), name: o.name });
});
