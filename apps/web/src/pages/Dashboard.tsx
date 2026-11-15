import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/endpoints';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  QueryState,
  Stat,
  UrgencyBadge,
} from '../components/ui';
import { useDashboard } from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { daysLabel, pct, qtyLabel } from '../lib/format';

export function DashboardPage() {
  const { isOwner, outlets, money } = useAuth();
  const [filter, setFilter] = useState('');
  const [windowDays, setWindowDays] = useState<7 | 30>(30);
  const q = useDashboard(filter || undefined);
  const qc = useQueryClient();
  const demo = useMutation({
    mutationFn: api.loadDemo,
    onSuccess: () => void qc.invalidateQueries(),
  });
  const outletName = (id: string) => outlets.find((o) => o.id === id)?.name ?? 'Outlet';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Stock value saved from waste, and what was still wasted (at cost)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && outlets.length > 1 && (
              <div>
                <label htmlFor="dash-outlet" className="sr-only">
                  Outlet filter
                </label>
                <select
                  id="dash-outlet"
                  className="input"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">All outlets</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div
              role="group"
              aria-label="Time window"
              className="inline-flex overflow-hidden rounded-lg border border-ink-300"
            >
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  aria-pressed={windowDays === d}
                  onClick={() => setWindowDays(d)}
                  className={`min-h-[44px] px-4 text-sm font-semibold ${windowDays === d ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
        }
      />
      <QueryState q={q}>
        {(d) => {
          const w = windowDays === 7 ? d.last7 : d.last30;
          const hasData = d.trend.length > 0 || w.saved + w.wasted > 0;
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                  label={`Saved · ${windowDays}d`}
                  value={money.format(w.saved)}
                  tone="good"
                  sub="Stock cost sold as specials"
                />
                <Stat
                  label={`Wasted · ${windowDays}d`}
                  value={money.format(w.wasted)}
                  tone="bad"
                  sub="Expired or logged as waste"
                />
                <Stat label="Save rate" value={pct(w.saveRate)} sub="saved ÷ (saved + wasted)" />
                <Stat
                  label={`Margin from specials · ${windowDays}d`}
                  value={money.format(w.marginEarned)}
                  sub="Sales minus portion cost"
                />
              </div>

              {!hasData ? (
                <EmptyState title="No history yet">
                  Run and end a special to start tracking what you save.
                  {isOwner && (
                    <div className="mt-4">
                      <button
                        className="btn-primary"
                        disabled={demo.isPending}
                        onClick={() => demo.mutate()}
                      >
                        {demo.isPending ? 'Loading demo data…' : 'Load demo data'}
                      </button>
                      <p className="mt-2 text-xs">
                        Adds sample ingredients, dishes, stock and 60 days of history. Only works on
                        an empty brand.
                      </p>
                      {demo.isError && (
                        <div className="mt-3 text-left">
                          <ErrorState error={demo.error} />
                        </div>
                      )}
                    </div>
                  )}
                </EmptyState>
              ) : (
                <section className="card p-4" aria-labelledby="trend-h">
                  <h2 id="trend-h" className="mb-3 font-semibold">
                    Weekly trend
                  </h2>
                  <div
                    className="h-72"
                    role="img"
                    aria-label="Weekly saved and wasted value with save rate line"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={d.trend.map((t) => ({
                          ...t,
                          savedMajor: money.toMajor(t.saved),
                          wastedMajor: money.toMajor(t.wasted),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8eeea" />
                        <XAxis
                          dataKey="week"
                          tickFormatter={(v: string) => v.slice(5)}
                          fontSize={12}
                        />
                        <YAxis yAxisId="l" fontSize={12} width={48} />
                        <YAxis
                          yAxisId="r"
                          orientation="right"
                          domain={[0, 100]}
                          unit="%"
                          fontSize={12}
                          width={40}
                        />
                        <Tooltip
                          formatter={(v: number, n: string) =>
                            n === 'Save rate'
                              ? `${v}%`
                              : money.format(Math.round(v * 10 ** money.digits))
                          }
                          labelFormatter={(l: string) => `Week of ${l}`}
                        />
                        <Legend />
                        <Bar
                          yAxisId="l"
                          dataKey="savedMajor"
                          name="Saved"
                          fill="#1e7e4e"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          yAxisId="l"
                          dataKey="wastedMajor"
                          name="Wasted"
                          fill="#c2410c"
                          radius={[3, 3, 0, 0]}
                        />
                        <Line
                          yAxisId="r"
                          type="monotone"
                          dataKey="saveRate"
                          name="Save rate"
                          stroke="#14201a"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {w.byOutlet.length > 1 && (
                  <section className="card overflow-x-auto p-4" aria-labelledby="out-h">
                    <h2 id="out-h" className="mb-3 font-semibold">
                      By outlet · {windowDays} days
                    </h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-ink-500">
                          <th className="pb-2">Outlet</th>
                          <th className="pb-2 text-right">Saved</th>
                          <th className="pb-2 text-right">Wasted</th>
                          <th className="pb-2 text-right">Save rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.byOutlet.map((o) => (
                          <tr key={o.outletId} className="border-t border-ink-100">
                            <td className="py-2 font-medium">{outletName(o.outletId)}</td>
                            <td className="py-2 text-right">{money.format(o.saved)}</td>
                            <td className="py-2 text-right">{money.format(o.wasted)}</td>
                            <td className="py-2 text-right font-semibold">{pct(o.saveRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}
                <section className="card p-4" aria-labelledby="top-h">
                  <h2 id="top-h" className="mb-3 font-semibold">
                    Top wasted ingredients · 30 days
                  </h2>
                  {d.topWasted.length === 0 ? (
                    <p className="text-sm text-ink-500">No waste recorded.</p>
                  ) : (
                    <ol className="space-y-2">
                      {d.topWasted.map((t, i) => {
                        const max = d.topWasted[0]?.valueWasted || 1;
                        return (
                          <li key={t.ingredientId}>
                            <div className="flex justify-between text-sm">
                              <span>
                                {i + 1}. {t.name}{' '}
                                <span className="text-ink-500">
                                  ({qtyLabel(t.qty, t.baseUnit)})
                                </span>
                              </span>
                              <span className="font-semibold">{money.format(t.valueWasted)}</span>
                            </div>
                            <div className="mt-1 h-2 rounded bg-ink-100" aria-hidden>
                              <div
                                className="h-2 rounded bg-orange-700"
                                style={{ width: `${(t.valueWasted / max) * 100}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
                <section className="card p-4" aria-labelledby="act-h">
                  <h2 id="act-h" className="mb-3 font-semibold">
                    Active specials
                  </h2>
                  {d.activeSpecials.length === 0 ? (
                    <p className="text-sm text-ink-500">
                      None running.{' '}
                      <Link className="font-semibold text-brand-700 underline" to="/app/at-risk">
                        Find stock to use up
                      </Link>
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {d.activeSpecials.map((s) => (
                        <li key={s.id} className="text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{s.name}</span>
                            <span>
                              {s.portionsSold}/{s.portionsPlanned} sold
                            </span>
                          </div>
                          <p className="text-xs text-ink-500">{outletName(s.outletId)}</p>
                          <progress
                            className="mt-1 h-2 w-full accent-brand-600"
                            value={s.portionsSold}
                            max={s.portionsPlanned}
                            aria-label={`${s.name} sold`}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="card p-4" aria-labelledby="risk-h">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 id="risk-h" className="font-semibold">
                      At risk now
                    </h2>
                    <Link
                      className="text-sm font-semibold text-brand-700 underline"
                      to="/app/at-risk"
                    >
                      Open board
                    </Link>
                  </div>
                  {d.atRisk.length === 0 ? (
                    <p className="text-sm text-ink-500">
                      Nothing at risk. Log new stock under Stock &amp; waste.
                    </p>
                  ) : (
                    <ul className="divide-y divide-ink-100">
                      {d.atRisk.slice(0, 5).map((r) => (
                        <li
                          key={r.batchId}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                        >
                          <span className="font-medium">
                            {r.ingredientName}{' '}
                            <span className="text-ink-500">
                              · {qtyLabel(r.qtyRemaining, r.baseUnit)} · {daysLabel(r.daysLeft)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <UrgencyBadge urgency={r.urgency} />
                            <span className="font-semibold">{money.format(r.valueAtRisk)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
