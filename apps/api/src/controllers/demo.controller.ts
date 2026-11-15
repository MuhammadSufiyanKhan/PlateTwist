import { conflict } from '../errors.js';
import { wrap } from '../middleware/core.js';
import { AiUsage, Batch, Dish, Ingredient, Outlet, Special, WasteEvent } from '../models/index.js';
import { populateDemo } from '../seed/seed.js';

/** Owner-only: loads demo data into a brand. Without ?replace=true it only works on an empty brand. */
export const loadDemo = wrap(async (req, res) => {
  const { brandId } = req.user;
  const replace = req.query.replace === 'true';
  if (await Ingredient.exists({ brandId })) {
    if (!replace)
      throw conflict(
        'Demo data can only be loaded into a brand with no ingredients yet',
        'NOT_EMPTY',
      );
    // Explicit replace: clears THIS brand's catalog, stock, specials and waste only.
    // Users, outlets and brand settings are kept.
    await Promise.all([
      Special.deleteMany({ brandId }),
      WasteEvent.deleteMany({ brandId }),
      Batch.deleteMany({ brandId }),
      Dish.deleteMany({ brandId }),
      Ingredient.deleteMany({ brandId }),
      AiUsage.deleteMany({ brandId }),
    ]);
  }
  const outlets = await Outlet.find({ brandId }).sort({ _id: 1 }).limit(2).lean();
  const a = outlets[0]?._id;
  if (!a) throw conflict('Create an outlet first', 'NO_OUTLET');
  const b = outlets[1]?._id ?? a;
  await populateDemo(brandId, { id: req.user.id, outletIds: [...new Set([a, b])] }, a, b);
  res.status(201).json({ ok: true });
});
