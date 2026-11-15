import type { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../errors.js';
import { Batch, Dish, Ingredient, type IDish, type IIngredient } from '../models/index.js';

export async function assertIngredientsExist(brandId: Types.ObjectId, ids: Types.ObjectId[]) {
  const uniq = new Set(ids.map(String));
  const found = await Ingredient.countDocuments({ brandId, _id: { $in: [...uniq] } });
  if (found !== uniq.size) throw badRequest('Unknown ingredient in recipe');
}

export async function updateIngredient(
  brandId: Types.ObjectId,
  id: Types.ObjectId,
  patch: Partial<Pick<IIngredient, 'name' | 'costPerBaseUnit' | 'isStaple'>>,
) {
  const ing = await Ingredient.findOneAndUpdate(
    { _id: id, brandId },
    { $set: patch },
    { new: true },
  ).lean();
  if (!ing) throw notFound('Ingredient');
  return ing;
}

export async function deleteIngredient(brandId: Types.ObjectId, id: Types.ObjectId) {
  const ing = await Ingredient.findOne({ _id: id, brandId }).lean();
  if (!ing) throw notFound('Ingredient');
  const inUse =
    (await Dish.exists({ brandId, 'recipe.ingredientId': id })) ||
    (await Batch.exists({ brandId, ingredientId: id }));
  if (inUse) throw conflict('Ingredient is used by dishes or batches', 'IN_USE');
  await Ingredient.deleteOne({ _id: id });
}

export async function saveDish(
  brandId: Types.ObjectId,
  input: { name: string; price: number; recipe: { ingredientId: Types.ObjectId; qty: number }[] },
  id?: Types.ObjectId,
): Promise<IDish> {
  await assertIngredientsExist(
    brandId,
    input.recipe.map((r) => r.ingredientId),
  );
  if (id) {
    const d = await Dish.findOneAndUpdate(
      { _id: id, brandId },
      { $set: input },
      { new: true },
    ).lean();
    if (!d) throw notFound('Dish');
    return d;
  }
  return (await Dish.create({ brandId, ...input })).toObject();
}
