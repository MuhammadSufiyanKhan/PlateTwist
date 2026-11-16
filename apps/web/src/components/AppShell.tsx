import {
  BarChart3,
  ChefHat,
  ClipboardList,
  LogOut,
  Menu,
  Package,
  Salad,
  Siren,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ThemeToggle } from './ThemeToggle';
import { FOOD_NOTICE } from './ui';

export function Logo({ onRail = false }: { onRail?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 font-display text-xl font-extrabold tracking-tight ${onRail ? 'text-white' : 'text-brand-700'}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-label text-label-ink">
        <ChefHat className="h-5 w-5" aria-hidden />
      </span>
      Specials Saver
    </span>
  );
}

export function AppShell() {
  const { user, brand, outlets, outletId, setOutletId, isOwner, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = [
    { to: '/app', label: 'Dashboard', icon: BarChart3, end: true, show: true },
    { to: '/app/at-risk', label: 'At risk', icon: Siren, show: true },
    { to: '/app/stock', label: 'Stock & waste', icon: Package, show: true },
    { to: '/app/specials', label: 'Specials', icon: ChefHat, show: true },
    { to: '/app/ingredients', label: 'Ingredients', icon: Salad, show: isOwner },
    { to: '/app/dishes', label: 'Dishes', icon: ClipboardList, show: isOwner },
    { to: '/app/team', label: 'Team & settings', icon: Users, show: isOwner },
  ].filter((n) => n.show);

  const links = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
              isActive ? 'bg-label text-label-ink' : 'text-[rgb(var(--rail-ink))] hover:bg-white/10'
            }`
          }
        >
          <Icon className="h-4 w-4" aria-hidden /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>
      <aside className="hidden flex-col bg-[rgb(var(--rail))] p-4 lg:flex">
        <div className="mb-8 mt-1 px-1">
          <Logo onRail />
        </div>
        {links}
        <p className="mt-auto rounded-xl border border-white/10 p-3 text-xs leading-relaxed text-[rgb(var(--rail-ink))]/80">
          Planning aid, not a food-safety system.
        </p>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-100 bg-surface/90 px-3 py-2 backdrop-blur sm:px-6">
          <button
            className="btn-secondary lg:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold">{brand?.name}</p>
            <p className="truncate text-xs text-ink-500">
              {user?.email} · {user?.role === 'OWNER' ? 'Owner' : 'Staff'}
            </p>
          </div>
          {outlets.length > 0 && (
            <div className="w-36 sm:w-52">
              <label htmlFor="outlet" className="sr-only">
                Outlet
              </label>
              <select
                id="outlet"
                className="input"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                disabled={outlets.length < 2}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <ThemeToggle className="hidden sm:inline-flex" />
          <button className="btn-secondary" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>
        {open && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[rgb(var(--rail))] p-4 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <Logo onRail />
                <button
                  className="btn-secondary"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {links}
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-sm text-[rgb(var(--rail-ink))]">Theme</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-6">
          <Outlet />
        </main>
        <footer className="border-t border-ink-100 bg-surface px-3 py-3 text-xs text-ink-500 sm:px-6">
          {FOOD_NOTICE}
        </footer>
      </div>
    </div>
  );
}
