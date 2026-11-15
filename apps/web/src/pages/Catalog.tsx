import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../api/endpoints';
import type { BaseUnit, Ingredient, Page, Unit } from '../api/types';
import { EmptyState, ErrorState, Field, PageHeader, QueryState } from '../components/ui';
import { useDishes, useIngredients } from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { UNIT_FACTOR, UNIT_OPTIONS } from '../lib/format';

const PER_LABEL: Record<BaseUnit, string> = { g: 'kg', ml: 'litre', pcs: 'piece' };
/** Price per kg / litre / piece in major units → minor units per base unit. */
const toBaseCost = (major: number, unit: BaseUnit, minorFactor: number): number =>
  (major * minorFactor) / (unit === 'pcs' ? 1 : 1000);
const fromBaseCost = (cost: number, unit: BaseUnit, minorFactor: number): number =>
  (cost * (unit === 'pcs' ? 1 : 1000)) / minorFactor;

export function IngredientsPage() {
  const { money } = useAuth();
  const q = useIngredients();
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['ingredients'] });
  const factor = 10 ** money.digits;
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState<BaseUnit>('g');
  const [price, setPrice] = useState('');
  const [isStaple, setStaple] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      api.createIngredient({
        name,
        baseUnit,
        costPerBaseUnit: toBaseCost(Number(price), baseUnit, factor),
        isStaple,
      }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setStaple(false);
      refresh();
    },
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; b: Partial<Ingredient> }) => api.patchIngredient(v.id, v.b),
    // Optimistic: show the change immediately, roll back if the save fails.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['ingredients'] });
      const prev = qc.getQueryData<Page<Ingredient>>(['ingredients']);
      if (prev)
        qc.setQueryData<Page<Ingredient>>(['ingredients'], {
          ...prev,
          items: prev.items.map((i) => (i.id === v.id ? { ...i, ...v.b } : i)),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ingredients'], ctx.prev);
    },
    onSettled: refresh,
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteIngredient(id),
    onSuccess: refresh,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <>
      <PageHeader
        title="Ingredients"
        subtitle="Cost is entered per kg, litre or piece. Staples (oil, salt…) add cost to a special but need no batch."
      />
      <form
        onSubmit={submit}
        className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_120px_160px_auto_auto] lg:items-end"
        aria-label="Add ingredient"
      >
        <Field label="Name" htmlFor="i-name">
          <input
            id="i-name"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Unit" htmlFor="i-unit">
          <select
            id="i-unit"
            className="input"
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value as BaseUnit)}
          >
            <option value="g">Weight (g)</option>
            <option value="ml">Volume (ml)</option>
            <option value="pcs">Pieces</option>
          </select>
        </Field>
        <Field label={`Cost per ${PER_LABEL[baseUnit]}`} htmlFor="i-cost">
          <input
            id="i-cost"
            className="input"
            type="number"
            min="0"
            step="any"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={isStaple}
            onChange={(e) => setStaple(e.target.checked)}
          />{' '}
          Staple
        </label>
        <button className="btn-primary" disabled={create.isPending}>
          Add
        </button>
        {create.isError && (
          <div className="col-span-full">
            <ErrorState error={create.error} />
          </div>
        )}
      </form>
      {(patch.isError || del.isError) && (
        <div className="mb-3">
          <ErrorState error={patch.error ?? del.error} />
        </div>
      )}
      <QueryState
        q={q}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No ingredients yet">Add your first ingredient above.</EmptyState>}
      >
        {(d) => (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Ingredients</caption>
              <thead>
                <tr className="text-left text-xs uppercase text-ink-500">
                  <th className="p-3">Name</th>
                  <th className="p-3">Cost per {'kg / l / pc'}</th>
                  <th className="p-3">Staple</th>
                  <th className="p-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...d.items]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((i) => (
                    <tr key={i.id} className="border-t border-ink-100">
                      <td className="p-3 font-medium">
                        {i.name} <span className="text-ink-500">({i.baseUnit})</span>
                      </td>
                      <td className="p-3">
                        <label className="sr-only" htmlFor={`c-${i.id}`}>
                          Cost for {i.name}
                        </label>
                        <input
                          id={`c-${i.id}`}
                          className="input w-28"
                          type="number"
                          min="0"
                          step="any"
                          defaultValue={fromBaseCost(i.costPerBaseUnit, i.baseUnit, factor).toFixed(
                            2,
                          )}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v))
                              patch.mutate({
                                id: i.id,
                                b: { costPerBaseUnit: toBaseCost(v, i.baseUnit, factor) },
                              });
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <label className="flex min-h-[44px] items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-600"
                            checked={i.isStaple}
                            onChange={(e) =>
                              patch.mutate({ id: i.id, b: { isStaple: e.target.checked } })
                            }
                            aria-label={`${i.name} is a staple`}
                          />
                        </label>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          className="btn-secondary"
                          aria-label={`Delete ${i.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete ${i.name}?`)) del.mutate(i.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}

interface Line {
  ingredientId: string;
  qty: string;
  unit: Unit;
}

export function DishesPage() {
  const { money } = useAuth();
  const dishes = useDishes();
  const ings = useIngredients();
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['dishes'] });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ingredientId: '', qty: '', unit: 'g' }]);
  const list = ings.data?.items ?? [];
  const byId = new Map(list.map((i) => [i.id, i]));
  const create = useMutation({
    mutationFn: () =>
      api.createDish({
        name,
        price: money.toMinor(Number(price)),
        recipe: lines
          .filter((l) => l.ingredientId)
          .map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty) * UNIT_FACTOR[l.unit] })),
      }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setLines([{ ingredientId: '', qty: '', unit: 'g' }]);
      refresh();
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.deleteDish(id), onSuccess: refresh });
  const setLine = (i: number, p: Partial<Line>) =>
    setLines(lines.map((l, k) => (k === i ? { ...l, ...p } : l)));

  return (
    <>
      <PageHeader
        title="Dishes"
        subtitle="Catalog dishes with recipes. Quantities are per portion."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="card mb-6 space-y-3 p-4"
        aria-label="Add dish"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label="Dish name" htmlFor="d-name">
            <input
              id="d-name"
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Menu price" htmlFor="d-price">
            <input
              id="d-price"
              className="input"
              type="number"
              min="0"
              step="any"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Recipe (per portion)</legend>
          {lines.map((l, i) => {
            const ing = byId.get(l.ingredientId);
            return (
              <div key={i} className="grid grid-cols-[1fr_90px_90px] gap-2">
                <select
                  aria-label={`Ingredient ${i + 1}`}
                  className="input"
                  value={l.ingredientId}
                  onChange={(e) => {
                    const x = byId.get(e.target.value);
                    setLine(i, {
                      ingredientId: e.target.value,
                      unit: x ? UNIT_OPTIONS[x.baseUnit][0]! : 'g',
                    });
                  }}
                >
                  <option value="">Ingredient…</option>
                  {list.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Quantity ${i + 1}`}
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                />
                <select
                  aria-label={`Unit ${i + 1}`}
                  className="input"
                  value={l.unit}
                  onChange={(e) => setLine(i, { unit: e.target.value as Unit })}
                >
                  {(ing ? UNIT_OPTIONS[ing.baseUnit] : ['g']).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
            );
          })}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setLines([...lines, { ingredientId: '', qty: '', unit: 'g' }])}
          >
            Add ingredient line
          </button>
        </fieldset>
        {create.isError && <ErrorState error={create.error} />}
        <button className="btn-primary" disabled={create.isPending}>
          Save dish
        </button>
      </form>
      {del.isError && (
        <div className="mb-3">
          <ErrorState error={del.error} />
        </div>
      )}
      <QueryState
        q={dishes}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No dishes yet">Add a dish above.</EmptyState>}
      >
        {(d) => (
          <ul className="grid gap-3 md:grid-cols-2">
            {d.items.map((x) => (
              <li key={x.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{x.name}</h3>
                    <p className="text-sm text-ink-500">{money.format(x.price)}</p>
                  </div>
                  <button
                    className="btn-secondary"
                    aria-label={`Delete ${x.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete ${x.name}?`)) del.mutate(x.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-2 text-sm text-ink-700">
                  {x.recipe
                    .map(
                      (r) =>
                        `${byId.get(r.ingredientId)?.name ?? '…'} ${r.qty}${byId.get(r.ingredientId)?.baseUnit ?? ''}`,
                    )
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
