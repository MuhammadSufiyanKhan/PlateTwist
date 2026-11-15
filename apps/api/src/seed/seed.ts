import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { costPerPortion, marginPct, suggestedPrice } from '../lib/calc.js';
import { DAY_MS, startOfUtcDay } from '../lib/risk.js';
import { makeRng } from '../lib/rng.js';
import type { BaseUnit } from '../lib/units.js';
import type { AuthUser } from '../middleware/core.js';
import {
  Batch,
  Brand,
  Dish,
  Ingredient,
  Outlet,
  Special,
  User,
  WasteEvent,
  type IIngredient,
} from '../models/index.js';
import { activateSpecial, createSpecial, recordSale } from '../services/special.service.js';

export const DEMO_PASSWORD = 'Demo1234!';
export const DEMO_USERS = {
  owner: 'owner@demo.test',
  staffDowntown: 'staff.downtown@demo.test',
  staffHarbour: 'staff.harbour@demo.test',
};

// name, unit, minor units per base unit, staple
const INGREDIENTS: [string, BaseUnit, number, boolean][] = [
  ['Chicken thigh', 'g', 1.1, false],
  ['Beef mince', 'g', 1.6, false],
  ['Salmon fillet', 'g', 3.2, false],
  ['Prawns', 'g', 3.8, false],
  ['Pork belly', 'g', 1.4, false],
  ['Lamb shoulder', 'g', 2.2, false],
  ['Bacon', 'g', 1.8, false],
  ['Spinach', 'g', 0.9, false],
  ['Kale', 'g', 0.8, false],
  ['Tomatoes', 'g', 0.45, false],
  ['Mushrooms', 'g', 0.9, false],
  ['Zucchini', 'g', 0.6, false],
  ['Bell peppers', 'g', 0.7, false],
  ['Carrots', 'g', 0.25, false],
  ['Potatoes', 'g', 0.2, false],
  ['Onions', 'g', 0.18, false],
  ['Basmati rice', 'g', 0.28, false],
  ['Penne pasta', 'g', 0.3, false],
  ['Mozzarella', 'g', 1.5, false],
  ['Parmesan', 'g', 3.4, false],
  ['Fresh basil', 'g', 4, false],
  ['Sourdough bread', 'g', 0.6, false],
  ['Cream', 'ml', 0.55, false],
  ['Milk', 'ml', 0.12, false],
  ['Eggs', 'pcs', 35, false],
  ['Lemons', 'pcs', 28, false],
  ['Avocado', 'pcs', 90, false],
  ['Olive oil', 'ml', 1.2, true],
  ['Vegetable oil', 'ml', 0.4, true],
  ['Sea salt', 'g', 0.1, true],
  ['Black pepper', 'g', 2, true],
  ['Plain flour', 'g', 0.15, true],
];

// name, price (minor), recipe [ingredient, qty in base units]
const DISHES: [string, number, [string, number][]][] = [
  [
    'Chicken rice bowl',
    1600,
    [
      ['Chicken thigh', 150],
      ['Basmati rice', 100],
      ['Bell peppers', 40],
      ['Olive oil', 10],
    ],
  ],
  [
    'Creamy salmon penne',
    2200,
    [
      ['Salmon fillet', 120],
      ['Penne pasta', 100],
      ['Cream', 60],
      ['Parmesan', 15],
      ['Lemons', 0.25],
    ],
  ],
  [
    'Mushroom risotto',
    1700,
    [
      ['Basmati rice', 90],
      ['Mushrooms', 120],
      ['Parmesan', 20],
      ['Onions', 30],
      ['Cream', 30],
    ],
  ],
  [
    'Beef ragu penne',
    1800,
    [
      ['Beef mince', 130],
      ['Penne pasta', 100],
      ['Tomatoes', 150],
      ['Onions', 40],
      ['Parmesan', 10],
    ],
  ],
  [
    'Garlicky prawn skillet',
    2400,
    [
      ['Prawns', 120],
      ['Tomatoes', 100],
      ['Zucchini', 80],
      ['Olive oil', 15],
      ['Lemons', 0.25],
    ],
  ],
  [
    'Spinach frittata',
    1400,
    [
      ['Eggs', 3],
      ['Spinach', 80],
      ['Mozzarella', 40],
      ['Onions', 30],
      ['Olive oil', 10],
    ],
  ],
  [
    'Crispy pork belly plate',
    2300,
    [
      ['Pork belly', 180],
      ['Potatoes', 200],
      ['Carrots', 80],
      ['Kale', 50],
    ],
  ],
  [
    'Lamb roast tray',
    2600,
    [
      ['Lamb shoulder', 200],
      ['Potatoes', 180],
      ['Carrots', 80],
      ['Onions', 40],
    ],
  ],
  [
    'Caprese salad',
    1300,
    [
      ['Tomatoes', 150],
      ['Mozzarella', 80],
      ['Fresh basil', 8],
      ['Olive oil', 10],
    ],
  ],
  [
    'Veggie stir-fry',
    1400,
    [
      ['Bell peppers', 80],
      ['Zucchini', 80],
      ['Carrots', 60],
      ['Mushrooms', 60],
      ['Basmati rice', 100],
      ['Vegetable oil', 10],
    ],
  ],
  [
    'Bacon carbonara',
    1750,
    [
      ['Bacon', 80],
      ['Penne pasta', 110],
      ['Eggs', 2],
      ['Parmesan', 20],
      ['Black pepper', 1],
    ],
  ],
  [
    'Avocado sourdough',
    1250,
    [
      ['Sourdough bread', 80],
      ['Avocado', 1],
      ['Eggs', 1],
      ['Lemons', 0.1],
    ],
  ],
];

const HISTORY_DAYS = 60;

export async function seedDemo(opts: { historyDays?: number; seed?: number } = {}): Promise<void> {
  const days = opts.historyDays ?? HISTORY_DAYS;
  const rng = makeRng(opts.seed ?? 20260301);
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  const brand = await Brand.create({
    name: 'Demo Bistro Group',
    currency: 'USD',
    targetMarginPct: 70,
    priceRounding: 50,
  });
  const [downtown, harbour] = await Outlet.create([
    { brandId: brand._id, name: 'Downtown' },
    { brandId: brand._id, name: 'Harbour' },
  ]);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [owner] = await User.create([
    {
      brandId: brand._id,
      email: DEMO_USERS.owner,
      passwordHash: hash,
      role: 'OWNER',
      outletIds: [downtown!._id, harbour!._id],
    },
    {
      brandId: brand._id,
      email: DEMO_USERS.staffDowntown,
      passwordHash: hash,
      role: 'STAFF',
      outletIds: [downtown!._id],
    },
    {
      brandId: brand._id,
      email: DEMO_USERS.staffHarbour,
      passwordHash: hash,
      role: 'STAFF',
      outletIds: [harbour!._id],
    },
  ]);

  const ings = await Ingredient.insertMany(
    INGREDIENTS.map(([name, baseUnit, costPerBaseUnit, isStaple]) => ({
      brandId: brand._id,
      name,
      baseUnit,
      costPerBaseUnit,
      isStaple,
    })),
  );
  const byName = new Map(ings.map((i) => [i.name, i.toObject() as IIngredient]));
  const ing = (n: string): IIngredient => {
    const i = byName.get(n);
    if (!i) throw new Error(`seed: unknown ingredient ${n}`);
    return i;
  };
  const calcMap = new Map([...byName.values()].map((i) => [i._id.toString(), i]));

  const dishes = await Dish.insertMany(
    DISHES.map(([name, price, recipe]) => ({
      brandId: brand._id,
      name,
      price,
      recipe: recipe.map(([n, qty]) => ({ ingredientId: ing(n)._id, qty })),
    })),
  );

  const today = startOfUtcDay(new Date());
  const at = (daysFromToday: number, hour = 0) =>
    new Date(today.getTime() + daysFromToday * DAY_MS + hour * 3_600_000);

  // ---- history: batches (closed), ended specials and waste with an improving save rate
  const batchDocs: object[] = [];
  const specialDocs: object[] = [];
  const wasteDocs: object[] = [];
  for (let d = days; d >= 1; d--) {
    const progress = 1 - d / days; // 0 = oldest, 1 = yesterday
    for (const outlet of [downtown!, harbour!]) {
      if (!rng.chance(0.8)) continue;
      const dish = dishes[rng.int(0, dishes.length - 1)]!;
      const items = dish.recipe.map((r) => ({
        ingredientId: r.ingredientId,
        qtyPerPortion: r.qty,
      }));
      const nonStaple = items.filter((i) => !calcMap.get(i.ingredientId.toString())?.isStaple);
      const main = nonStaple[0]!;
      const planned = rng.int(8, 28);
      const rate = Math.min(0.95, Math.max(0.2, 0.35 + 0.5 * progress + (rng.next() - 0.5) * 0.16));
      const sold = Math.round(rate * planned);
      const cMap = new Map([...calcMap.entries()].map(([k, v]) => [k, v]));
      const cost = costPerPortion(
        items.map((i) => ({
          ingredientId: i.ingredientId.toString(),
          qtyPerPortion: i.qtyPerPortion,
        })),
        cMap,
      );
      const price = suggestedPrice(cost, 70, 50);
      const stockCost = nonStaple.reduce(
        (a, i) => a + i.qtyPerPortion * calcMap.get(i.ingredientId.toString())!.costPerBaseUnit,
        0,
      );
      const batchId = new Types.ObjectId();
      batchDocs.push({
        _id: batchId,
        brandId: brand._id,
        outletId: outlet._id,
        ingredientId: main.ingredientId,
        qtyRemaining: 0,
        qtyAllocated: 0,
        expiresOn: at(-d + 1),
        dateType: 'USE_BY',
        status: 'CLOSED',
        createdAt: at(-d, 8),
      });
      specialDocs.push({
        brandId: brand._id,
        outletId: outlet._id,
        name: dish.name,
        description: `Special built from ${dish.name}`,
        items,
        portionsPlanned: planned,
        portionsSold: sold,
        costPerPortion: cost,
        price,
        marginPct: marginPct(price, cost),
        status: 'ENDED',
        source: rng.chance(0.5) ? 'AI' : 'CATALOG',
        allocations: nonStaple.map((i) => ({
          batchId,
          ingredientId: i.ingredientId,
          qty: i.qtyPerPortion * planned,
        })),
        savedValue: Math.round(sold * stockCost),
        wastedValue: Math.round((planned - sold) * stockCost),
        startedAt: at(-d, 11),
        endedAt: at(-d, 21),
        createdAt: at(-d, 10),
      });
      if (planned > sold)
        wasteDocs.push({
          brandId: brand._id,
          outletId: outlet._id,
          batchId,
          ingredientId: main.ingredientId,
          qty: (planned - sold) * main.qtyPerPortion,
          valueMinor: Math.round(
            (planned - sold) *
              main.qtyPerPortion *
              calcMap.get(main.ingredientId.toString())!.costPerBaseUnit,
          ),
          reason: 'EXPIRED',
          date: at(-d, 22),
        });
      // Occasional spoilage that becomes rarer as processes improve.
      if (rng.chance(0.25 * (1 - 0.6 * progress))) {
        const i = rng.pick(ings.filter((x) => !x.isStaple));
        const qty = i.baseUnit === 'pcs' ? rng.int(2, 10) : rng.int(100, 600);
        wasteDocs.push({
          brandId: brand._id,
          outletId: outlet._id,
          ingredientId: i._id,
          qty,
          valueMinor: Math.round(qty * i.costPerBaseUnit),
          reason: rng.pick(['SPOILED', 'OTHER'] as const),
          date: at(-d, 15),
        });
      }
    }
  }
  await Batch.insertMany(batchDocs);
  await Special.insertMany(specialDocs);
  await WasteEvent.insertMany(wasteDocs);

  // ---- current stock: varied expiry (today, tomorrow, 3 days)
  const cur: [typeof downtown, string, number, number, 'USE_BY' | 'BEST_BEFORE'][] = [
    [downtown, 'Chicken thigh', 3000, 0, 'USE_BY'],
    [downtown, 'Salmon fillet', 1500, 1, 'USE_BY'],
    [downtown, 'Spinach', 1200, 1, 'USE_BY'],
    [downtown, 'Tomatoes', 4000, 3, 'USE_BY'],
    [downtown, 'Mushrooms', 2000, 2, 'USE_BY'],
    [downtown, 'Basmati rice', 5000, 4, 'BEST_BEFORE'],
    [downtown, 'Bell peppers', 1500, 2, 'USE_BY'],
    [harbour, 'Prawns', 1000, 1, 'USE_BY'],
    [harbour, 'Beef mince', 2500, 3, 'USE_BY'],
    [harbour, 'Zucchini', 2000, 2, 'USE_BY'],
    [harbour, 'Mozzarella', 800, 3, 'BEST_BEFORE'],
    [harbour, 'Cream', 2000, 1, 'USE_BY'],
  ];
  await Batch.insertMany(
    cur.map(([o, n, qty, dd, dateType]) => ({
      brandId: brand._id,
      outletId: o!._id,
      ingredientId: ing(n)._id,
      qtyRemaining: qty,
      expiresOn: at(dd),
      dateType,
    })),
  );

  // ---- one live special at Downtown, created and activated through the real service
  const ownerUser: AuthUser = {
    id: owner!._id,
    brandId: brand._id,
    role: 'OWNER',
    outletIds: [downtown!._id, harbour!._id],
  };
  const chickenBowl = dishes.find((d) => d.name === 'Chicken rice bowl')!;
  const live = await createSpecial(ownerUser, {
    outletId: downtown!._id,
    dishId: chickenBowl._id,
    portionsPlanned: 12,
    source: 'CATALOG',
  });
  await activateSpecial(ownerUser, live._id);
  for (let i = 0; i < 5; i++) await recordSale(ownerUser, live._id);
}
