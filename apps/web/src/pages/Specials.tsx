import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/endpoints';
import type { EndSummary, Special } from '../api/types';
import { ALLERGEN_NOTICE, EmptyState, ErrorState, Field, PageHeader, QueryState } from '../components/ui';
import { useDishes, useSpecials } from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { pct, qtyLabel } from '../lib/format';

type Tab = 'ACTIVE' | 'ENDED';

export function SpecialsPage() {
  const { outletId, money } = useAuth();
  const [tab, setTab] = useState<Tab>('ACTIVE');
  const q = useSpecials(outletId, tab);
  const qc = useQueryClient();
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const refresh = () => void qc.invalidateQueries();
  const sell = useMutation({ mutationFn: (id: string) => api.sell(id), onSuccess: refresh });
  const end = useMutation({
    mutationFn: (id: string) => api.endSpecial(id),
    onSuccess: (r) => { setSummary(r); refresh(); },
  });

  return (
    <>
      <PageHeader title="Specials" subtitle="Record each sale with +1, and end a special to release unsold stock and count what you saved." />
      <NewFromDish onDone={refresh} />
      <div role="tablist" aria-label="Specials status" className="mb-4 inline-flex overflow-hidden rounded-lg border border-ink-300">
        {(['ACTIVE', 'ENDED'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] px-5 text-sm font-semibold ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'}`}>
            {t === 'ACTIVE' ? 'Active' : 'Ended'}
          </button>
        ))}
      </div>
      {sell.isError && <div className="mb-3"><ErrorState error={sell.error} /></div>}
      {end.isError && <div className="mb-3"><ErrorState error={end.error} /></div>}
      <QueryState q={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title={tab === 'ACTIVE' ? 'No active specials' : 'No ended specials yet'}>{tab === 'ACTIVE' ? 'Run a suggestion from the At risk page, or start one from a dish above.' : 'Ended specials and their results show up here.'}</EmptyState>}>
        {(d) => (
          <ul className="grid gap-4 md:grid-cols-2">
            {d.items.map((s) => <SpecialCard key={s.id} s={s} busy={sell.isPending || end.isPending} onSell={() => sell.mutate(s.id)} onEnd={() => { if (window.confirm(`End “${s.name}”? Unsold stock goes back to inventory.`)) end.mutate(s.id); }} />)}
          </ul>
        )}
      </QueryState>
      <p className="mt-4 text-xs text-ink-500">{ALLERGEN_NOTICE}</p>
      {summary && (
        <div role="dialog" aria-modal="true" aria-labelledby="sum-h" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="card w-full max-w-md space-y-3 p-5">
            <h2 id="sum-h" className="text-lg font-bold">“{summary.special.name}” ended</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-ink-500">Sold</dt><dd className="text-lg font-bold">{summary.portionsSold} / {summary.portionsPlanned}</dd></div>
              <div><dt className="text-ink-500">Stock value saved</dt><dd className="text-lg font-bold text-brand-700">{money.format(summary.savedValue)}</dd></div>
              <div><dt className="text-ink-500">Released to stock</dt><dd className="text-lg font-bold">{money.format(summary.releasedValue)}</dd></div>
              <div><dt className="text-ink-500">Already expired</dt><dd className="text-lg font-bold text-red-700">{money.format(summary.wastedValue)}</dd></div>
              <div><dt className="text-ink-500">Revenue</dt><dd className="font-bold">{money.format(summary.revenue)}</dd></div>
              <div><dt className="text-ink-500">Margin earned</dt><dd className="font-bold">{money.format(summary.marginEarned)}</dd></div>
            </dl>
            <p className="text-xs text-ink-500">Released stock returns to your at-risk board. Anything that later expires or is logged as waste is counted as wasted.</p>
            <button className="btn-primary w-full" onClick={() => setSummary(null)} autoFocus>Done</button>
          </div>
        </div>
      )}
    </>
  );
}

function SpecialCard({ s, busy, onSell, onEnd }: { s: Special; busy: boolean; onSell: () => void; onEnd: () => void }) {
  const { money } = useAuth();
  const remaining = s.portionsPlanned - s.portionsSold;
  return (
    <li className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{s.name}</h3>
          <p className="text-xs text-ink-500">{s.source === 'AI' ? 'AI idea' : 'Catalog dish'} · {money.format(s.price)} · margin {pct(s.marginPct)}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.status === 'ACTIVE' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-ink-300 bg-ink-50 text-ink-700'}`}>{s.status === 'ACTIVE' ? 'Active' : 'Ended'}</span>
      </div>
      {s.description && <p className="mt-1 text-sm text-ink-700">{s.description}</p>}
      <p className="mt-2 text-xs text-ink-500">{s.items.map((i) => `${i.name} ${qtyLabel(i.qtyPerPortion, i.baseUnit)}`).join(' · ')}</p>
      <div className="mt-3">
        <div className="flex justify-between text-sm"><span className="font-semibold">{s.portionsSold} / {s.portionsPlanned} sold</span><span className="text-ink-500">{remaining} left</span></div>
        <progress className="mt-1 h-3 w-full accent-brand-600" value={s.portionsSold} max={s.portionsPlanned} aria-label="Portions sold" />
      </div>
      {s.status === 'ACTIVE' ? (
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1 text-base" disabled={busy || remaining === 0} onClick={onSell} aria-label={`Add one sold: ${s.name}`}><Plus className="h-5 w-5" aria-hidden /> 1 sold</button>
          <button className="btn-secondary" disabled={busy} onClick={onEnd}>End special</button>
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-3 text-sm">
          <div><dt className="text-xs text-ink-500">Saved</dt><dd className="font-bold text-brand-700">{money.format(s.savedValue)}</dd></div>
          <div><dt className="text-xs text-ink-500">Expired on release</dt><dd className="font-bold">{money.format(s.wastedValue)}</dd></div>
        </dl>
      )}
    </li>
  );
}

function NewFromDish({ onDone }: { onDone: () => void }) {
  const { outletId } = useAuth();
  const dishes = useDishes();
  const [open, setOpen] = useState(false);
  const [dishId, setDishId] = useState('');
  const [portions, setPortions] = useState('');
  const create = useMutation({
    mutationFn: () => api.createSpecial({ outletId, dishId, source: 'CATALOG', activate: true, portionsPlanned: portions ? Number(portions) : undefined }),
    onSuccess: () => { setOpen(false); setPortions(''); onDone(); },
  });
  return (
    <div className="mb-4">
      <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Start a special from a catalog dish</button>
      {open && (
        <form className="card mt-3 grid gap-3 p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); create.mutate(); }} aria-label="Start special from dish">
          <Field label="Dish" htmlFor="ns-dish">
            <select id="ns-dish" className="input" required value={dishId} onChange={(e) => setDishId(e.target.value)}>
              <option value="">Select…</option>
              {(dishes.data?.items ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Portions" htmlFor="ns-p" hint="Blank = as many as stock allows">
            <input id="ns-p" className="input" type="number" min={1} value={portions} onChange={(e) => setPortions(e.target.value)} />
          </Field>
          <button className="btn-primary" disabled={create.isPending || !dishId}>Run special</button>
          {create.isError && <div className="col-span-full"><ErrorState error={create.error} /></div>}
        </form>
      )}
    </div>
  );
}
