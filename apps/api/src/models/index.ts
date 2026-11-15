import { Schema, model, type Types } from 'mongoose';
import type { BaseUnit } from '../lib/units.js';

type Id = Types.ObjectId;

export interface IBrand {
  _id: Id;
  name: string;
  currency: string;
  targetMarginPct: number;
  priceRounding: number;
  allowBestBeforeExpired: boolean;
}
export interface IOutlet {
  _id: Id;
  brandId: Id;
  name: string;
}
export interface IUser {
  _id: Id;
  brandId: Id;
  email: string;
  passwordHash: string;
  role: 'OWNER' | 'STAFF';
  outletIds: Id[];
}
export interface IIngredient {
  _id: Id;
  brandId: Id;
  name: string;
  baseUnit: BaseUnit;
  /** Minor units per ONE base unit (may be fractional, e.g. 0.9 per gram). */
  costPerBaseUnit: number;
  isStaple: boolean;
}
export interface IDish {
  _id: Id;
  brandId: Id;
  name: string;
  price: number;
  recipe: { ingredientId: Id; qty: number }[];
}
export interface IBatch {
  _id: Id;
  brandId: Id;
  outletId: Id;
  ingredientId: Id;
  qtyRemaining: number;
  qtyAllocated: number;
  expiresOn: Date;
  dateType: 'USE_BY' | 'BEST_BEFORE';
  status: 'ACTIVE' | 'CLOSED';
  createdAt: Date;
}
export interface ISpecial {
  _id: Id;
  brandId: Id;
  outletId: Id;
  name: string;
  description: string;
  items: { ingredientId: Id; qtyPerPortion: number }[];
  portionsPlanned: number;
  portionsSold: number;
  costPerPortion: number;
  price: number;
  marginPct: number;
  status: 'SUGGESTED' | 'ACTIVE' | 'ENDED';
  source: 'AI' | 'CATALOG';
  allocations: { batchId: Id; ingredientId: Id; qty: number }[];
  savedValue: number;
  wastedValue: number;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}
export interface IWasteEvent {
  _id: Id;
  brandId: Id;
  outletId: Id;
  batchId?: Id;
  ingredientId: Id;
  qty: number;
  valueMinor: number;
  reason: 'EXPIRED' | 'SPOILED' | 'OTHER';
  date: Date;
}
export interface IAiUsage {
  _id: Id;
  brandId: Id;
  day: string;
  count: number;
}

const oid = (ref: string, required = true) => ({ type: Schema.Types.ObjectId, ref, required });

export const Brand = model<IBrand>(
  'Brand',
  new Schema<IBrand>({
    name: { type: String, required: true },
    currency: { type: String, default: 'USD' },
    targetMarginPct: { type: Number, default: 70, min: 0, max: 95 },
    priceRounding: { type: Number, default: 50, min: 1 },
    allowBestBeforeExpired: { type: Boolean, default: false },
  }),
);

export const Outlet = model<IOutlet>(
  'Outlet',
  new Schema<IOutlet>({ brandId: oid('Brand'), name: { type: String, required: true } }),
);

const userSchema = new Schema<IUser>({
  brandId: oid('Brand'),
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['OWNER', 'STAFF'], required: true },
  outletIds: [{ type: Schema.Types.ObjectId, ref: 'Outlet' }],
});
export const User = model<IUser>('User', userSchema);

const ingSchema = new Schema<IIngredient>({
  brandId: oid('Brand'),
  name: { type: String, required: true, trim: true },
  baseUnit: { type: String, enum: ['g', 'ml', 'pcs'], required: true },
  costPerBaseUnit: { type: Number, required: true, min: 0 },
  isStaple: { type: Boolean, default: false },
});
ingSchema.index({ brandId: 1, name: 1 }, { unique: true });
export const Ingredient = model<IIngredient>('Ingredient', ingSchema);

export const Dish = model<IDish>(
  'Dish',
  new Schema<IDish>({
    brandId: oid('Brand'),
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    recipe: [{ _id: false, ingredientId: oid('Ingredient'), qty: { type: Number, min: 0 } }],
  }),
);

const batchSchema = new Schema<IBatch>(
  {
    brandId: oid('Brand'),
    outletId: oid('Outlet'),
    ingredientId: oid('Ingredient'),
    qtyRemaining: { type: Number, required: true, min: 0 },
    qtyAllocated: { type: Number, default: 0, min: 0 },
    expiresOn: { type: Date, required: true },
    dateType: { type: String, enum: ['USE_BY', 'BEST_BEFORE'], required: true },
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
batchSchema.index({ brandId: 1, outletId: 1, status: 1, expiresOn: 1 });
export const Batch = model<IBatch>('Batch', batchSchema);

const specialSchema = new Schema<ISpecial>(
  {
    brandId: oid('Brand'),
    outletId: oid('Outlet'),
    name: { type: String, required: true },
    description: { type: String, default: '' },
    items: [{ _id: false, ingredientId: oid('Ingredient'), qtyPerPortion: Number }],
    portionsPlanned: { type: Number, required: true, min: 1 },
    portionsSold: { type: Number, default: 0, min: 0 },
    costPerPortion: { type: Number, required: true },
    price: { type: Number, required: true },
    marginPct: { type: Number, required: true },
    status: { type: String, enum: ['SUGGESTED', 'ACTIVE', 'ENDED'], default: 'SUGGESTED' },
    source: { type: String, enum: ['AI', 'CATALOG'], required: true },
    allocations: [
      { _id: false, batchId: oid('Batch'), ingredientId: oid('Ingredient'), qty: Number },
    ],
    savedValue: { type: Number, default: 0 },
    wastedValue: { type: Number, default: 0 },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
specialSchema.index({ brandId: 1, outletId: 1, status: 1, endedAt: -1 });
export const Special = model<ISpecial>('Special', specialSchema);

const wasteSchema = new Schema<IWasteEvent>({
  brandId: oid('Brand'),
  outletId: oid('Outlet'),
  batchId: oid('Batch', false),
  ingredientId: oid('Ingredient'),
  qty: { type: Number, required: true },
  valueMinor: { type: Number, required: true },
  reason: { type: String, enum: ['EXPIRED', 'SPOILED', 'OTHER'], required: true },
  date: { type: Date, required: true },
});
wasteSchema.index({ brandId: 1, outletId: 1, date: -1 });
export const WasteEvent = model<IWasteEvent>('WasteEvent', wasteSchema);

const aiUsageSchema = new Schema<IAiUsage>({
  brandId: oid('Brand'),
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
});
aiUsageSchema.index({ brandId: 1, day: 1 }, { unique: true });
export const AiUsage = model<IAiUsage>('AiUsage', aiUsageSchema);
