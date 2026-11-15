import { conflict } from '../errors.js';
import { wrap } from '../middleware/core.js';
import { Ingredient, Outlet } from '../models/index.js';
import { populateDemo } from '../seed/seed.js';

/** Owner-only: fills an EMPTY brand with demo data. Never deletes or overwrites anything. */
export const loadDemo = wrap(async (req, res) => {
  const { brandId } = req.user;
  if (await Ingredient.exists({ brandId }))
    throw conflict(
      'Demo data can only be loaded into a brand with no ingredients yet',
      'NOT_EMPTY',
    );
  const outlets = await Outlet.find({ brandId }).sort({ _id: 1 }).limit(2).lean();
  const a = outlets[0]?._id;
  if (!a) throw conflict('Create an outlet first', 'NO_OUTLET');
  const b = outlets[1]?._id ?? a;
  await populateDemo(brandId, { id: req.user.id, outletIds: [...new Set([a, b])] }, a, b);
  res.status(201).json({ ok: true });
});
