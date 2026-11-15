import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import type { Brand, Me, Outlet, User } from '../api/types';
import { makeMoney, type Money } from './format';

interface AuthState {
  user: User | null;
  brand: Brand | null;
  outlets: Outlet[];
  outletId: string;
  setOutletId: (id: string) => void;
  money: Money;
  isOwner: boolean;
  loading: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(tokenStore.get());
  const me = useQuery<Me>({ queryKey: ['me', token], queryFn: api.me, enabled: !!token, retry: false });
  const outletsQ = useQuery({ queryKey: ['outlets', token], queryFn: api.outlets, enabled: !!token && !!me.data });
  const [selected, setSelected] = useState<string>('');

  const signOut = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setSelected('');
    qc.clear();
  }, [qc]);
  const signIn = useCallback((t: string) => {
    tokenStore.set(t);
    setToken(t);
  }, []);
  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  const outlets = useMemo(() => outletsQ.data?.items ?? [], [outletsQ.data]);
  const outletId = outlets.some((o) => o.id === selected) ? selected : (outlets[0]?.id ?? '');
  const value: AuthState = {
    user: me.data?.user ?? null,
    brand: me.data?.brand ?? null,
    outlets,
    outletId,
    setOutletId: setSelected,
    money: makeMoney(me.data?.brand.currency ?? 'USD'),
    isOwner: me.data?.user.role === 'OWNER',
    loading: !!token && (me.isLoading || outletsQ.isLoading),
    signIn,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
