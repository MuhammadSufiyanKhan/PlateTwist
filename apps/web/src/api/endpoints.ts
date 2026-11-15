import { request } from './client';
import type {
  AtRiskRow,
  Batch,
  Brand,
  Dashboard,
  DateType,
  Dish,
  EndSummary,
  Ingredient,
  Me,
  Outlet,
  Page,
  Special,
  Suggestions,
  TeamUser,
  Unit,
  User,
} from './types';

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/login', { body: { email, password } }),
  register: (b: { brandName: string; currency: string; email: string; password: string }) =>
    request<{ token: string; user: User }>('POST', '/auth/register', { body: b }),
  me: () => request<Me>('GET', '/auth/me'),
  outlets: () => request<Page<Outlet>>('GET', '/outlets'),
  createOutlet: (name: string) => request<Outlet>('POST', '/outlets', { body: { name } }),
  users: () => request<Page<TeamUser>>('GET', '/users', { query: { limit: 200 } }),
  invite: (b: { email: string; password: string; outletIds: string[] }) =>
    request<TeamUser>('POST', '/users', { body: b }),
  patchBrand: (
    b: Partial<
      Pick<Brand, 'name' | 'targetMarginPct' | 'priceRounding' | 'allowBestBeforeExpired'>
    >,
  ) => request<Brand>('PATCH', '/brand', { body: b }),

  ingredients: () => request<Page<Ingredient>>('GET', '/ingredients', { query: { limit: 200 } }),
  createIngredient: (b: Omit<Ingredient, 'id'>) =>
    request<Ingredient>('POST', '/ingredients', { body: b }),
  patchIngredient: (
    id: string,
    b: Partial<Pick<Ingredient, 'name' | 'costPerBaseUnit' | 'isStaple'>>,
  ) => request<Ingredient>('PATCH', `/ingredients/${id}`, { body: b }),
  deleteIngredient: (id: string) => request<void>('DELETE', `/ingredients/${id}`),
  dishes: () => request<Page<Dish>>('GET', '/dishes', { query: { limit: 200 } }),
  createDish: (b: Omit<Dish, 'id'>) => request<Dish>('POST', '/dishes', { body: b }),
  deleteDish: (id: string) => request<void>('DELETE', `/dishes/${id}`),

  atRisk: (outletId: string) => request<Page<AtRiskRow>>('GET', `/outlets/${outletId}/at-risk`),
  batches: (outletId: string) =>
    request<Page<Batch>>('GET', '/batches', { query: { outletId, status: 'ACTIVE', limit: 100 } }),
  createBatch: (b: {
    outletId: string;
    ingredientId: string;
    qty: number;
    unit: Unit;
    expiresOn: string;
    dateType: DateType;
  }) => request<{ id: string }>('POST', '/batches', { body: b }),
  logWaste: (b: {
    outletId: string;
    batchId: string;
    qty: number;
    unit: Unit;
    reason: 'EXPIRED' | 'SPOILED' | 'OTHER';
  }) => request<{ id: string; valueMinor: number }>('POST', '/waste', { body: b }),

  specials: (outletId: string | undefined, status?: Special['status']) =>
    request<Page<Special>>('GET', '/specials', { query: { outletId, status, limit: 50 } }),
  createSpecial: (b: {
    outletId: string;
    dishId?: string;
    name?: string;
    description?: string;
    portionsPlanned?: number;
    source: 'AI' | 'CATALOG';
    items?: { ingredientId: string; qtyPerPortion: number }[];
    activate: boolean;
  }) => request<Special>('POST', '/specials', { body: b }),
  sell: (id: string) => request<Special>('POST', `/specials/${id}/sold`),
  endSpecial: (id: string) => request<EndSummary>('POST', `/specials/${id}/end`),
  suggest: (outletId: string, batchIds: string[]) =>
    request<Suggestions>('POST', `/outlets/${outletId}/suggestions`, { body: { batchIds } }),

  loadDemo: () => request<{ ok: boolean }>('POST', '/demo-data'),
  dashboard: (outletId?: string) =>
    request<Dashboard>('GET', '/dashboard', { query: { outletId } }),
};
