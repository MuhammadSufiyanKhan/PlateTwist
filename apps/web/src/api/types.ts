export type Role = 'OWNER' | 'STAFF';
export type BaseUnit = 'g' | 'ml' | 'pcs';
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'dozen';
export type DateType = 'USE_BY' | 'BEST_BEFORE';

export interface User { id: string; brandId: string; email: string; role: Role; outletIds: string[] }
export interface Brand { id: string; name: string; currency: string; targetMarginPct: number; priceRounding: number; allowBestBeforeExpired: boolean }
export interface Outlet { id: string; name: string }
export interface Me { user: User; brand: Brand }
export interface Page<T> { items: T[]; nextCursor: string | null }

export interface Ingredient { id: string; name: string; baseUnit: BaseUnit; costPerBaseUnit: number; isStaple: boolean }
export interface Dish { id: string; name: string; price: number; recipe: { ingredientId: string; qty: number }[] }
export interface Batch { id: string; ingredientId: string; ingredientName: string; baseUnit: BaseUnit; qtyRemaining: number; qtyAllocated: number; expiresOn: string; dateType: DateType; status: 'ACTIVE' | 'CLOSED' }

export type Urgency = 'TODAY' | 'TOMORROW' | 'SOON' | 'LATER';
export interface AtRiskRow {
  batchId: string; ingredientId: string; ingredientName: string; baseUnit: BaseUnit; qtyRemaining: number; qtyAllocated: number;
  expiresOn: string; dateType: DateType; daysLeft: number; urgency: Urgency; valueAtRisk: number; stockValue: number; outletId?: string;
}

export interface SpecialItem { ingredientId: string; name: string; baseUnit: BaseUnit; isStaple: boolean; qtyPerPortion: number }
export interface Special {
  id: string; outletId: string; name: string; description: string; status: 'SUGGESTED' | 'ACTIVE' | 'ENDED'; source: 'AI' | 'CATALOG';
  portionsPlanned: number; portionsSold: number; costPerPortion: number; price: number; marginPct: number; savedValue: number; wastedValue: number;
  startedAt: string | null; endedAt: string | null; items: SpecialItem[];
}
export interface EndSummary { special: Special; portionsSold: number; portionsPlanned: number; savedValue: number; wastedValue: number; releasedValue: number; revenue: number; marginEarned: number }

export interface SuggestionCard {
  name: string; description: string; portions: number; costPerPortion: number; price: number; marginPct: number; savedValue: number;
  items: { ingredientId: string; name: string; baseUnit: BaseUnit; isStaple: boolean; qtyPerPortion: number }[];
}
export interface Suggestions { cards: SuggestionCard[]; provider: string; basedOn: string[] }

export interface WindowSummary { saved: number; wasted: number; saveRate: number | null; marginEarned: number; byOutlet: { outletId: string; saved: number; wasted: number; saveRate: number | null }[] }
export interface Dashboard {
  currency: string; outlets: Outlet[]; last7: WindowSummary; last30: WindowSummary;
  trend: { week: string; saved: number; wasted: number; saveRate: number | null }[];
  topWasted: { ingredientId: string; name: string; baseUnit: BaseUnit; valueWasted: number; qty: number }[];
  activeSpecials: { id: string; outletId: string; name: string; portionsSold: number; portionsPlanned: number }[];
  atRisk: AtRiskRow[];
}
export interface TeamUser { id: string; email: string; role: Role; outletIds: string[] }
