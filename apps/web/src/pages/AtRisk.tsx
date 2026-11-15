import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';
import type { SuggestionCard } from '../api/types';
import { ALLERGEN_NOTICE, EmptyState, ErrorState, PageHeader, QueryState, Spinner, UrgencyBadge } from '../components/ui';
import { useAtRisk } from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { daysLabel, pct, qtyLabel } from '../lib/format';

export function AtRiskPage() {
  const { outletId, money } = useAuth();
  const q = useAtRisk(outletId);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [selected, setSelected] = useState<string[] | null>(null);
  const rows = q.data?.items ?? [];
  const chosen = selected ?? rows.slice(0, 5).map((r) => r.batchId);
  useEffect(() => setSelected(null), [outletId]);

  const suggest = useMutation({ mutationFn: () => api.suggest(outletId, chosen) });
  const run = useMutation({
    mutationFn: (v: { card: SuggestionCard; portions: number }) =>
      api.createSpecial({
        outletId, name: v.card.name, description: v.card.description, source: 'AI', activate: true, portionsPlanned: v.portions,
        items: v.card.items.map((i) => ({ ingredientId: i.ingredientId, qtyPerPortion: i.qtyPerPortion })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries();
      nav('/app/specials');
    },
  });
  const toggle = (id: string) => setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  return (
    <>
      <PageHeader
        title="At-risk stock"
        subtitle="Ranked by value at risk = quantity × cost ÷ days left (minimum 0.5 days). Expired use-by stock is never offered."
        actions={
          <button className="btn-primary" disabled={chosen.length === 0 || suggest.isPending} onClick={() => suggest.mutate()}>
            <Sparkles className="h-4 w-4" aria-hidden /> Suggest specials ({chosen.length} selected)
          </button>
        }
      />
      <QueryState q={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Nothing at risk">Log stock under “Stock &amp; waste” to see it ranked here.</EmptyState>}>
        {(d) => (
          <ul className="space-y-2" aria-label="At-risk batches">
            {d.items.map((r, i) => (
              <li key={r.batchId} className="card p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <input id={`sel-${r.batchId}`} type="checkbox" className="h-5 w-5 shrink-0 accent-brand-600" checked={chosen.includes(r.batchId)} onChange={() => toggle(r.batchId)} aria-label={`Include ${r.ingredientName} in suggestions`} />
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-ink-500" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
                  <p className="min-w-0 flex-1 font-semibold">{r.ingredientName}</p>
                  <UrgencyBadge urgency={r.urgency} />
                  <div className="hidden text-right sm:block">
                    <p className="text-lg font-bold">{money.format(r.valueAtRisk)}</p>
                    <p className="text-xs text-ink-500">at risk · stock {money.format(r.stockValue)}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3 pl-[3.25rem]">
                  <p className="text-sm text-ink-500">
                    {qtyLabel(r.qtyRemaining, r.baseUnit)} free{r.qtyAllocated > 0 && ` · ${qtyLabel(r.qtyAllocated, r.baseUnit)} in specials`} · {r.dateType === 'USE_BY' ? 'Use by' : 'Best before'} {r.expiresOn} ({daysLabel(r.daysLeft)})
                  </p>
                  <p className="shrink-0 text-right sm:hidden"><span className="block text-lg font-bold">{money.format(r.valueAtRisk)}</span><span className="block text-xs text-ink-500">at risk</span></p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {suggest.isPending && <Spinner label="Asking for ideas" />}
      {suggest.isError && <div className="mt-4"><ErrorState error={suggest.error} onRetry={() => suggest.mutate()} /></div>}
      {run.isError && <div className="mt-4"><ErrorState error={run.error} /></div>}
      {suggest.data && (
        <section className="mt-8" aria-labelledby="sug-h">
          <h2 id="sug-h" className="text-lg font-bold">Suggested specials</h2>
          <p className="mb-3 text-sm text-ink-500">Ideas come from the {suggest.data.provider} provider; every number below is calculated by the app from your costs and stock. {ALLERGEN_NOTICE}</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {suggest.data.cards.map((c) => <SuggestionCardView key={c.name} card={c} busy={run.isPending} onRun={(portions) => run.mutate({ card: c, portions })} />)}
          </div>
        </section>
      )}
    </>
  );
}

function SuggestionCardView({ card, busy, onRun }: { card: SuggestionCard; busy: boolean; onRun: (portions: number) => void }) {
  const { money } = useAuth();
  const [portions, setPortions] = useState(card.portions);
  const id = `portions-${card.name.replace(/\W+/g, '-')}`;
  return (
    <article className="card flex flex-col p-4">
      <h3 className="font-bold">{card.name}</h3>
      <p className="mt-1 text-sm text-ink-700">{card.description}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {card.items.map((i) => (
          <li key={i.ingredientId} className="flex justify-between"><span>{i.name}{i.isStaple && <span className="text-ink-500"> (staple)</span>}</span><span className="text-ink-500">{qtyLabel(i.qtyPerPortion, i.baseUnit)} / portion</span></li>
        ))}
      </ul>
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-3 text-sm">
        <div><dt className="text-xs text-ink-500">Portions possible</dt><dd className="font-bold">{card.portions}</dd></div>
        <div><dt className="text-xs text-ink-500">Cost / portion</dt><dd className="font-bold">{money.format(card.costPerPortion)}</dd></div>
        <div><dt className="text-xs text-ink-500">Suggested price</dt><dd className="font-bold">{money.format(card.price)}</dd></div>
        <div><dt className="text-xs text-ink-500">Margin</dt><dd className="font-bold">{pct(card.marginPct)}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-ink-500">Stock value it would save</dt><dd className="font-bold text-brand-700">{money.format(card.savedValue)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-ink-500">{ALLERGEN_NOTICE}</p>
      <div className="mt-auto flex items-end gap-2 pt-3">
        <div className="w-24">
          <label htmlFor={id} className="label">Portions</label>
          <input id={id} type="number" min={1} max={card.portions} className="input" value={portions} onChange={(e) => setPortions(Math.min(card.portions, Math.max(1, Number(e.target.value) || 1)))} />
        </div>
        <button className="btn-primary flex-1" disabled={busy} onClick={() => onRun(portions)}>Run this special</button>
      </div>
    </article>
  );
}
