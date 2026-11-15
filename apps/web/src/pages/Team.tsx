import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/endpoints';
import { EmptyState, ErrorState, Field, PageHeader, QueryState } from '../components/ui';
import { useAuth } from '../lib/auth';

export function TeamPage() {
  const { outlets, brand } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ['users'], queryFn: api.users });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [outletName, setOutletName] = useState('');
  const invite = useMutation({
    mutationFn: () => api.invite({ email, password, outletIds: picked }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setPicked([]);
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const addOutlet = useMutation({
    mutationFn: () => api.createOutlet(outletName),
    onSuccess: () => {
      setOutletName('');
      void qc.invalidateQueries({ queryKey: ['outlets'] });
    },
  });
  const [margin, setMargin] = useState(String(brand?.targetMarginPct ?? 70));
  const [rounding, setRounding] = useState(String(brand?.priceRounding ?? 50));
  const [bb, setBb] = useState(brand?.allowBestBeforeExpired ?? false);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api.patchBrand({
        targetMarginPct: Number(margin),
        priceRounding: Number(rounding),
        allowBestBeforeExpired: bb,
      }),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Team & settings"
        subtitle="Invite staff to outlets, add outlets, and set pricing rules for this brand."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="card space-y-3 p-4"
          aria-label="Pricing and rules"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(false);
            save.mutate();
          }}
        >
          <h2 className="font-semibold">Pricing &amp; rules</h2>
          <Field
            label="Target margin (%)"
            htmlFor="s-m"
            hint="Suggested price = cost ÷ (1 − margin)."
          >
            <input
              id="s-m"
              className="input"
              type="number"
              min={0}
              max={95}
              step="any"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
            />
          </Field>
          <Field
            label="Round prices up to a multiple of (minor units)"
            htmlFor="s-r"
            hint="e.g. 50 = nearest 0.50 when the currency has 2 decimals."
          >
            <input
              id="s-r"
              className="input"
              type="number"
              min={1}
              step={1}
              value={rounding}
              onChange={(e) => setRounding(e.target.value)}
            />
          </Field>
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={bb}
              onChange={(e) => setBb(e.target.checked)}
            />{' '}
            Allow best-before stock past its date to be used in specials
          </label>
          {save.isError && <ErrorState error={save.error} />}
          {saved && (
            <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
              Saved.
            </p>
          )}
          <button className="btn-primary" disabled={save.isPending}>
            Save settings
          </button>
        </form>

        <section className="card space-y-3 p-4" aria-labelledby="out-h">
          <h2 id="out-h" className="font-semibold">
            Outlets
          </h2>
          <ul className="text-sm">
            {outlets.map((o) => (
              <li key={o.id} className="border-b border-ink-100 py-2">
                {o.name}
              </li>
            ))}
          </ul>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addOutlet.mutate();
            }}
            aria-label="Add outlet"
          >
            <div className="flex-1">
              <Field label="New outlet name" htmlFor="o-name">
                <input
                  id="o-name"
                  className="input"
                  required
                  minLength={2}
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                />
              </Field>
            </div>
            <button className="btn-primary" disabled={addOutlet.isPending}>
              Add
            </button>
          </form>
          {addOutlet.isError && <ErrorState error={addOutlet.error} />}
        </section>

        <form
          className="card space-y-3 p-4"
          aria-label="Invite staff"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <h2 className="font-semibold">Invite staff</h2>
          <Field label="Email" htmlFor="u-e">
            <input
              id="u-e"
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="Temporary password"
            htmlFor="u-p"
            hint="Share it with them directly; at least 8 characters."
          >
            <input
              id="u-p"
              type="text"
              className="input"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <fieldset>
            <legend className="label">Outlets</legend>
            {outlets.map((o) => (
              <label key={o.id} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={picked.includes(o.id)}
                  onChange={() =>
                    setPicked(
                      picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id],
                    )
                  }
                />{' '}
                {o.name}
              </label>
            ))}
          </fieldset>
          {invite.isError && <ErrorState error={invite.error} />}
          <button className="btn-primary" disabled={invite.isPending || picked.length === 0}>
            Create staff login
          </button>
        </form>

        <section className="card p-4" aria-labelledby="tm-h">
          <h2 id="tm-h" className="mb-3 font-semibold">
            People
          </h2>
          <QueryState
            q={users}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState title="No users" />}
          >
            {(d) => (
              <ul className="divide-y divide-ink-100 text-sm">
                {d.items.map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-medium">{u.email}</span>
                    <span className="text-ink-500">
                      {u.role === 'OWNER'
                        ? 'Owner · all outlets'
                        : `Staff · ${u.outletIds.map((id) => outlets.find((o) => o.id === id)?.name ?? '…').join(', ')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </section>
      </div>
    </>
  );
}
