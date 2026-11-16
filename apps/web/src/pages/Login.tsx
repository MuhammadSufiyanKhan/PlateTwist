import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Logo } from '../components/AppShell';
import { ThemeToggle } from '../components/ThemeToggle';
import { ErrorState, Field, FOOD_NOTICE } from '../components/ui';
import { useAuth } from '../lib/auth';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const m = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? api.login(email, password)
        : api.register({ brandName, currency: 'USD', email, password }),
    onSuccess: (r) => {
      signIn(r.token);
      nav('/app');
    },
  });
  if (user) return <Navigate to="/app" replace />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[rgb(var(--rail))] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-label/20 blur-3xl"
        />
        <Link to="/" className="relative">
          <Logo onRail />
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            Sell it before you bin it.
          </h2>
          <p className="mt-3 text-[rgb(var(--rail-ink))]">
            Log what is about to expire, run a priced special, and watch the waste you saved add up.
          </p>
          <div className="ticket mt-8 -rotate-1 text-ink-900">
            <div className="ticket-stub p-0">
              <span className="sticker-TOMORROW flex h-full w-full flex-col items-center justify-center rounded-l-2xl text-xs font-bold">
                Tomorrow
              </span>
            </div>
            <div className="ticket-body">
              <p className="font-display text-lg font-bold">Salmon fillet</p>
              <p className="text-sm text-ink-500">1.5 kg free. Use by tomorrow.</p>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-[rgb(var(--rail-ink))]/80">{FOOD_NOTICE}</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="lg:hidden">
              <Logo />
            </Link>
            <ThemeToggle className="ml-auto" />
          </div>
          <form
            onSubmit={submit}
            className="card space-y-4 p-6"
            aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
          >
            <h1 className="text-3xl font-extrabold">
              {mode === 'login' ? 'Welcome back' : 'Create your brand'}
            </h1>
            {mode === 'register' && (
              <Field label="Restaurant or brand name" htmlFor="brand">
                <input
                  id="brand"
                  className="input"
                  required
                  minLength={2}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              hint={mode === 'register' ? 'At least 8 characters.' : undefined}
            >
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="input"
                required
                minLength={mode === 'register' ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {m.isError && <ErrorState error={m.error} />}
            <button className="btn-primary w-full" disabled={m.isPending}>
              {m.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
            <p className="text-center text-sm text-ink-500">
              {mode === 'login' ? (
                <>
                  New here?{' '}
                  <Link className="font-semibold text-brand-700 underline" to="/register">
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Have an account?{' '}
                  <Link className="font-semibold text-brand-700 underline" to="/login">
                    Sign in
                  </Link>
                </>
              )}
            </p>
            {mode === 'login' && (
              <p className="rounded-xl bg-raised p-3 text-xs text-ink-700">
                <strong>Demo logins</strong> (if demo data was loaded): owner@demo.test or
                staff.downtown@demo.test, password <code>Demo1234!</code>
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-xs text-ink-500 lg:hidden">{FOOD_NOTICE}</p>
        </div>
      </main>
    </div>
  );
}
