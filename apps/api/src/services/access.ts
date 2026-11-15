import type { Types } from 'mongoose';
import { forbidden, notFound } from '../errors.js';
import type { AuthUser } from '../middleware/core.js';
import { Brand, Outlet, type IBrand, type IOutlet } from '../models/index.js';

/** Resolves an outlet inside the user's brand (404 otherwise) and checks staff outlet scope (403). */
export async function assertOutlet(user: AuthUser, outletId: Types.ObjectId): Promise<IOutlet> {
  const outlet = await Outlet.findOne({ _id: outletId, brandId: user.brandId }).lean();
  if (!outlet) throw notFound('Outlet');
  if (user.role === 'STAFF' && !user.outletIds.some((o) => o.equals(outletId)))
    throw forbidden('You do not have access to this outlet');
  return outlet;
}

export async function getBrand(brandId: Types.ObjectId): Promise<IBrand> {
  const b = await Brand.findById(brandId).lean();
  if (!b) throw notFound('Brand');
  return b;
}

/** Outlet ids the user may read: all in brand for owners, own outlets for staff. */
export async function visibleOutletIds(user: AuthUser): Promise<Types.ObjectId[]> {
  if (user.role === 'STAFF') return user.outletIds;
  const outlets = await Outlet.find({ brandId: user.brandId }).select('_id').lean();
  return outlets.map((o) => o._id);
}
