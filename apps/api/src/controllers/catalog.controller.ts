import { z } from 'zod';
import { notFound } from '../errors.js';
import { UNIT_KEYS } from '../lib/units.js';
import { parseId, validate, wrap } from '../middleware/core.js';
import { Dish, Ingredient, type IDish, type IIngredient } from '../models/index.js';
import { deleteIngredient, saveDish, updateIngredient } from '../services/catalog.service.js';
import { pageQuery, paginate } from '../services/paginate.js';

void UNIT_KEYS;
const presentIng = (i: IIngredient) => ({
  id: i._id.toString(),
  name: i.name,
  baseUnit: i.baseUnit,
  costPerBaseUnit: i.costPerBaseUnit,
  isStaple: i.isStaple,
});
const presentDish = (d: IDish) => ({
  id: d._id.toString(),
  name: d.name,
  price: d.price,
  recipe: d.recipe.map((r) => ({ ingredientId: r.ingredientId.toString(), qty: r.qty })),
});

export const listIngredients = wrap(async (req, res) => {
  const q = validate(pageQuery, req.query);
  const p = await paginate(Ingredient, { brandId: req.user.brandId }, q);
  res.json({ items: p.items.map(presentIng), nextCursor: p.nextCursor });
});

const ingBody = z.object({
  name: z.string().trim().min(1).max(80),
  baseUnit: z.enum(['g', 'ml', 'pcs']),
  costPerBaseUnit: z.number().min(0).max(1_000_000),
  isStaple: z.boolean().default(false),
});

export const createIngredient = wrap(async (req, res) => {
  const body = validate(ingBody, req.body);
  const i = await Ingredient.create({ brandId: req.user.brandId, ...body });
  res.status(201).json(presentIng(i.toObject()));
});

export const patchIngredient = wrap(async (req, res) => {
  const body = validate(
    ingBody.pick({ name: true, costPerBaseUnit: true, isStaple: true }).partial(),
    req.body,
  );
  const i = await updateIngredient(req.user.brandId, parseId(req.params.id, 'Ingredient'), body);
  res.json(presentIng(i));
});

export const removeIngredient = wrap(async (req, res) => {
  await deleteIngredient(req.user.brandId, parseId(req.params.id, 'Ingredient'));
  res.status(204).end();
});

export const listDishes = wrap(async (req, res) => {
  const q = validate(pageQuery, req.query);
  const p = await paginate(Dish, { brandId: req.user.brandId }, q);
  res.json({ items: p.items.map(presentDish), nextCursor: p.nextCursor });
});

const dishBody = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().int().min(0),
  recipe: z
    .array(
      z.object({
        ingredientId: z.string().transform((s) => parseId(s, 'Ingredient')),
        qty: z.number().positive(),
      }),
    )
    .min(1)
    .max(30),
});

export const createDish = wrap(async (req, res) => {
  const body = validate(dishBody, req.body);
  res.status(201).json(presentDish(await saveDish(req.user.brandId, body)));
});

export const updateDish = wrap(async (req, res) => {
  const body = validate(dishBody, req.body);
  res.json(presentDish(await saveDish(req.user.brandId, body, parseId(req.params.id, 'Dish'))));
});

export const removeDish = wrap(async (req, res) => {
  const r = await Dish.deleteOne({
    _id: parseId(req.params.id, 'Dish'),
    brandId: req.user.brandId,
  });
  if (r.deletedCount === 0) throw notFound('Dish');
  res.status(204).end();
});
