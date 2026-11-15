import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { AppError, badRequest, conflict } from '../errors.js';
import { signToken } from '../middleware/core.js';
const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
import { Brand, Outlet, User, type IUser } from '../models/index.js';

export const publicUser = (u: IUser) => ({
  id: u._id.toString(),
  brandId: u.brandId.toString(),
  email: u.email,
  role: u.role,
  outletIds: u.outletIds.map((o) => o.toString()),
});

export async function registerBrand(input: {
  brandName: string;
  currency: string;
  email: string;
  password: string;
}) {
  if (await User.exists({ email: input.email.toLowerCase() }))
    throw conflict('Email already registered', 'EMAIL_TAKEN');
  const brand = await Brand.create({ name: input.brandName, currency: input.currency });
  const outlet = await Outlet.create({ brandId: brand._id, name: 'Main outlet' });
  const user = await User.create({
    brandId: brand._id,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, ROUNDS),
    role: 'OWNER',
    outletIds: [outlet._id],
  });
  return { token: signToken(user._id.toString()), user: publicUser(user.toObject()) };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');
  return { token: signToken(user._id.toString()), user: publicUser(user) };
}

export async function inviteStaff(
  brandId: Types.ObjectId,
  input: { email: string; password: string; outletIds: string[] },
) {
  const outlets = await Outlet.find({ brandId, _id: { $in: input.outletIds } })
    .select('_id')
    .lean();
  if (outlets.length !== new Set(input.outletIds).size || outlets.length === 0)
    throw badRequest('One or more outlets do not exist in your brand');
  if (await User.exists({ email: input.email.toLowerCase() }))
    throw conflict('Email already registered', 'EMAIL_TAKEN');
  const user = await User.create({
    brandId,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, ROUNDS),
    role: 'STAFF',
    outletIds: outlets.map((o) => o._id),
  });
  return publicUser(user.toObject());
}
