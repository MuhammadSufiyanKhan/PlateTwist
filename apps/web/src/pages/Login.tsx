import { useMutation } from '@tanstack/react-query';
import { ChefHat } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';
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
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2 text-xl font-bold text-brand-700"
        >
          <ChefHat className="h-6 w-6" aria-hidden /> Specials Saver
        </Link>
        <form
          onSubmit={submit}
          className="card space-y-4 p-6"
          aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
        >
          <h1 className="text-xl font-bold">
            {mode === 'login' ? 'Sign in' : 'Create your brand'}
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
            <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
              <strong>
                Demo (after <code>npm run seed</code>):
              </strong>{' '}
              owner@demo.test or staff.downtown@demo.test, password <code>Demo1234!</code>
            </p>
          )}
        </form>
        <p className="mt-4 text-center text-xs text-ink-500">{FOOD_NOTICE}</p>
      </div>
    </div>
  );
}
