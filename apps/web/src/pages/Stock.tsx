import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../api/endpoints';
import type { Batch, DateType, Unit } from '../api/types';
import { EmptyState, ErrorState, Field, PageHeader, QueryState } from '../components/ui';
import { useBatches, useIngredients } from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { qtyLabel, todayIso, UNIT_OPTIONS } from '../lib/format';

export function StockPage() {
  const { outletId, isOwner } = useAuth();
  const ings = useIngredients();
  const batches = useBatches(outletId);
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries();

  const [ingredientId, setIngredientId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [expiresOn, setExpiresOn] = useState(todayIso(2));
  const [dateType, setDateType] = useState<DateType>('USE_BY');
  const [done, setDone] = useState('');
  const list = ings.data?.items ?? [];
  const ing = list.find((i) => i.id === ingredientId);

  const add = useMutation({
    mutationFn: () => api.createBatch({ outletId, ingredientId, qty: Number(qty), unit, expiresOn, dateType }),
    onSuccess: () => {
      setDone(`Logged ${qty} ${unit} of ${ing?.name}.`);
      setQty('');
      refresh();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone('');
    add.mutate();
  };

  return (
    <>
      <PageHeader title="Stock & waste" subtitle="Log what comes in with its expiry date; log waste when stock is thrown away." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-4 p-4" aria-label="Log a batch">
          <h2 className="font-semibold">Log a batch</h2>
          <Field label="Ingredient" htmlFor="b-ing">
            <select id="b-ing" className="input" required value={ingredientId}
              onChange={(e) => { setIngredientId(e.target.value); const i = list.find((x) => x.id === e.target.value); if (i) setUnit(UNIT_OPTIONS[i.baseUnit][0]!); }}>
              <option value="">Select…</option>
              {list.filter((i) => !i.isStaple).sort((a, b) => a.name.localeCompare(b.name)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          {ings.isError && <ErrorState error={ings.error} />}
          {ings.data && list.length === 0 && <p className="text-sm text-ink-500">{isOwner ? 'Add ingredients first under Ingredients.' : 'Ask the owner to add ingredients first.'}</p>}
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Field label="Quantity" htmlFor="b-qty">
              <input id="b-qty" className="input" type="number" inputMode="decimal" min="0" step="any" required value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Unit" htmlFor="b-unit">
              <select id="b-unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} disabled={!ing}>
                {(ing ? UNIT_OPTIONS[ing.baseUnit] : ['g']).map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Expiry date" htmlFor="b-exp">
            <input id="b-exp" className="input" type="date" required value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="label">Date type</legend>
            <div className="flex gap-4 text-sm">
              {(['USE_BY', 'BEST_BEFORE'] as const).map((t) => (
                <label key={t} className="flex min-h-[44px] items-center gap-2">
                  <input type="radio" name="dtype" className="h-4 w-4 accent-brand-600" checked={dateType === t} onChange={() => setDateType(t)} />
                  {t === 'USE_BY' ? 'Use by' : 'Best before'}
                </label>
              ))}
            </div>
          </fieldset>
          {add.isError && <ErrorState error={add.error} />}
          {done && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{done}</p>}
          <button className="btn-primary w-full" disabled={add.isPending || !ingredientId}>{add.isPending ? 'Saving…' : 'Log batch'}</button>
        </form>

        <section aria-labelledby="active-h">
          <h2 id="active-h" className="mb-3 font-semibold">Active batches</h2>
          <QueryState q={batches} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No active batches">Log your first batch with the form.</EmptyState>}>
            {(d) => <ul className="space-y-2">{d.items.map((b) => <BatchRow key={b.id} b={b} outletId={outletId} onDone={refresh} />)}</ul>}
          </QueryState>
        </section>
      </div>
    </>
  );
}

function BatchRow({ b, outletId, onDone }: { b: Batch; outletId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>(UNIT_OPTIONS[b.baseUnit][0]!);
  const [reason, setReason] = useState<'EXPIRED' | 'SPOILED' | 'OTHER'>('SPOILED');
  const waste = useMutation({
    mutationFn: () => api.logWaste({ outletId, batchId: b.id, qty: Number(qty), unit, reason }),
    onSuccess: () => { setOpen(false); setQty(''); onDone(); },
  });
  return (
    <li className="card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{b.ingredientName}</p>
          <p className="text-sm text-ink-500">{qtyLabel(b.qtyRemaining, b.baseUnit)} free{b.qtyAllocated > 0 && ` · ${qtyLabel(b.qtyAllocated, b.baseUnit)} in specials`} · {b.dateType === 'USE_BY' ? 'Use by' : 'Best before'} {b.expiresOn}</p>
        </div>
        <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Log waste</button>
      </div>
      {open && (
        <form className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); waste.mutate(); }} aria-label={`Log waste for ${b.ingredientName}`}>
          <Field label="Quantity" htmlFor={`w-q-${b.id}`}><input id={`w-q-${b.id}`} className="input" type="number" min="0" step="any" required value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Unit" htmlFor={`w-u-${b.id}`}><select id={`w-u-${b.id}`} className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>{UNIT_OPTIONS[b.baseUnit].map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label="Reason" htmlFor={`w-r-${b.id}`}><select id={`w-r-${b.id}`} className="input" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}><option value="SPOILED">Spoiled</option><option value="EXPIRED">Expired</option><option value="OTHER">Other</option></select></Field>
          <div className="flex items-end"><button className="btn-danger w-full" disabled={waste.isPending}>Record waste</button></div>
          {waste.isError && <div className="col-span-full"><ErrorState error={waste.error} /></div>}
        </form>
      )}
    </li>
  );
}
