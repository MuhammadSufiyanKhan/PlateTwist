import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';

export const useIngredients = () =>
  useQuery({ queryKey: ['ingredients'], queryFn: api.ingredients });
export const useDishes = () => useQuery({ queryKey: ['dishes'], queryFn: api.dishes });
export const useAtRisk = (outletId: string) =>
  useQuery({
    queryKey: ['at-risk', outletId],
    queryFn: () => api.atRisk(outletId),
    enabled: !!outletId,
  });
export const useBatches = (outletId: string) =>
  useQuery({
    queryKey: ['batches', outletId],
    queryFn: () => api.batches(outletId),
    enabled: !!outletId,
  });
export const useSpecials = (outletId: string, status?: 'SUGGESTED' | 'ACTIVE' | 'ENDED') =>
  useQuery({
    queryKey: ['specials', outletId, status],
    queryFn: () => api.specials(outletId, status),
    enabled: !!outletId,
  });
export const useDashboard = (outletId?: string) =>
  useQuery({ queryKey: ['dashboard', outletId ?? 'all'], queryFn: () => api.dashboard(outletId) });
