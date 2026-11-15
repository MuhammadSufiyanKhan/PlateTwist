import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Urgency } from '../api/types';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-ink-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden /> Error
      </p>
      <p className="mt-1">{msg}</p>
      {onRetry && (
        <button className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = CheckCircle2 }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-ink-300" aria-hidden />
      <p className="mt-2 font-semibold text-ink-900">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

/** Renders loading / error / empty states around a query. */
export function QueryState<T>({
  q,
  isEmpty,
  empty,
  children,
}: {
  q: UseQueryResult<T>;
  isEmpty?: (d: T) => boolean;
  empty?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data === undefined) return null;
  if (isEmpty?.(q.data)) return <>{empty}</>;
  return <>{children(q.data)}</>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

const URGENCY: Record<Urgency, { label: string; icon: LucideIcon; cls: string }> = {
  TODAY: { label: 'Use today', icon: AlertTriangle, cls: 'border-red-300 bg-red-50 text-red-900' },
  TOMORROW: { label: 'Tomorrow', icon: Clock, cls: 'border-amber-300 bg-amber-50 text-amber-900' },
  SOON: { label: 'Within 3 days', icon: CalendarClock, cls: 'border-yellow-300 bg-yellow-50 text-yellow-900' },
  LATER: { label: 'Later', icon: CheckCircle2, cls: 'border-brand-200 bg-brand-50 text-brand-800' },
};
/** Urgency by label and icon as well as colour. */
export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const u = URGENCY[urgency];
  const Icon = u.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${u.cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {u.label}
    </span>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-brand-700' : tone === 'bad' ? 'text-red-700' : 'text-ink-900';
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

export const FOOD_NOTICE = 'Planning aid only, not a food-safety system. Always follow your own food-safety procedures and check allergens with the kitchen before serving.';
export const ALLERGEN_NOTICE = 'Check allergens with the kitchen before serving.';
