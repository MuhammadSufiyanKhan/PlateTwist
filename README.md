# Specials Saver

B2B SaaS for restaurants: log stock batches with expiry dates, see what is about to be wasted ranked by **money at risk**, get **AI-suggested specials** whose cost, price, margin and portions are computed in code, run the special, record sales, end it, and track **stock value saved vs wasted** on a dashboard.

> **Planning aid, not a food-safety system.** It does not replace your food-safety procedures. Check allergens with the kitchen before serving any special.

## Features

- Brand → outlets tenancy; roles **Owner** (all outlets, dashboard, catalog, users) and **Staff** (own outlets).
- Batches with unit conversion (g/kg, ml/l, pcs/dozen), USE_BY / BEST_BEFORE, waste logging.
- At-risk board: `valueAtRisk = qtyRemaining × costPerBaseUnit ÷ max(daysLeft, 0.5)`; urgency by label + icon + colour.
- Expired USE_BY stock is never offered to the AI or allocated; `sweepExpired` turns it into waste (idempotent). BEST_BEFORE past date is excluded by default (brand setting).
- Special calculator (pure functions): cost/portion, suggested price (cost ÷ (1 − margin), rounded up), margin, max portions.
- Lifecycle: create from dish or draft → activate (FEFO allocation, atomic conditional updates, compensating rollback) → `+1 sold` (never above planned) → end (release unsold, compute saved value).
- AI suggestions (mock / Gemini / OpenAI-compatible) with strict validation; rate limit and daily cap per brand.
- Dashboard: saved/wasted for 7 and 30 days, per outlet, save rate, weekly trend, top wasted ingredients, margin from specials, active specials, at-risk list.
- Landing page (GSAP + ScrollTrigger, honours `prefers-reduced-motion`).

## Architecture

npm-workspaces monorepo. `apps/api`: Express + Mongoose + zod, layered routes → controllers → services → models; all calculations are pure functions in `src/lib`. `apps/web`: React + Vite + React Router + TanStack Query + Tailwind + Recharts; only `src/api` talks to the API. Money is integer minor units (ingredient `costPerBaseUnit` is minor units per base unit and may be fractional, e.g. 1.1 per gram; every computed money value is rounded to an integer). Quantities are stored in base units. Dates are UTC days. `brandId` always comes from the authenticated user's DB record, never from the client.

## Quick start

```bash
cp .env.example .env
docker compose up -d        # MongoDB 7
npm install
npm run seed                # deterministic demo data (REPLACES the database contents)
npm run dev:api             # http://localhost:4000
npm run dev:web             # http://localhost:5173 (proxies /api to :4000)
```

## Demo logins (demo data only, password `Demo1234!`)

| Role                 | Email                      |
| -------------------- | -------------------------- |
| Owner (both outlets) | `owner@demo.test`          |
| Staff (Downtown)     | `staff.downtown@demo.test` |
| Staff (Harbour)      | `staff.harbour@demo.test`  |

The seed creates 1 brand, 2 outlets, 32 ingredients (6 staples), 12 dishes, 11 current batches expiring today / tomorrow / in 2–4 days, one live special, and 60 days of history in which the save rate improves from ~35% to ~85%.

## Environment variables

| Var                                       | Default                                    | Notes                                                                                       |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `PORT`                                    | 4000                                       |                                                                                             |
| `MONGODB_URI`                             | `mongodb://localhost:27017/specials_saver` |                                                                                             |
| `JWT_SECRET`                              | dev value                                  | **required in production** (≥16 chars)                                                      |
| `JWT_EXPIRES_IN`                          | 8h                                         |                                                                                             |
| `CORS_ORIGINS`                            | `http://localhost:5173`                    | comma-separated allowlist                                                                   |
| `AI_PROVIDER`                             | `mock`                                     | `mock`, `gemini`, `openai_compat`                                                           |
| `AI_MODEL` / `AI_API_KEY` / `AI_BASE_URL` | empty                                      | hosted providers; base URL only for `openai_compat` (e.g. `https://api.groq.com/openai/v1`) |
| `AI_DAILY_CAP_PER_BRAND`                  | 50                                         | suggestion requests per brand per UTC day                                                   |
| `VITE_API_URL`                            | `/api/v1`                                  | web build-time API base                                                                     |
| `MONGODB_URI_TEST`                        | `mongodb://localhost:27017/specials_test`  | used by tests                                                                               |

## API (`/api/v1`, Bearer JWT; errors `{ error: { code, message, details? } }`; lists take `limit`/`cursor`)

| Method & path                                             | Who                   | Purpose                               |
| --------------------------------------------------------- | --------------------- | ------------------------------------- |
| `GET /health`                                             | public                | liveness                              |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | public / any          | brand + owner signup, login, profile  |
| `GET/POST /users`                                         | owner                 | list / invite staff                   |
| `PATCH /brand`                                            | owner                 | margin, rounding, best-before rule    |
| `GET/POST /outlets`                                       | any / owner           | outlets                               |
| `GET/POST/PATCH/DELETE /ingredients`                      | read any, write owner | catalog                               |
| `GET/POST/PUT/DELETE /dishes`                             | read any, write owner | catalog                               |
| `GET /outlets/:id/at-risk`                                | outlet access         | ranked board (sweeps expired)         |
| `GET/POST /batches`                                       | outlet access         | list / log batch                      |
| `GET/POST /waste`                                         | outlet access         | list / log waste                      |
| `GET/POST /specials`, `GET /specials/:id`                 | outlet access         | list, create (`activate:true` to run) |
| `POST /specials/:id/activate\|sold\|end`                  | outlet access         | lifecycle                             |
| `POST /outlets/:id/suggestions`                           | outlet access         | AI suggestion cards (rate limited)    |
| `GET /dashboard?outletId=`                                | any (staff scoped)    | metrics                               |

## Metric definitions

- **Saved** = Σ `savedValue` of specials ended in the window = cost of stock consumed by sold portions (non-staple, at ingredient cost).
- **Wasted** = Σ `WasteEvent.valueMinor` in the window (expiry sweeps and manual waste logs). `Special.wastedValue` is informational: released stock already expired when the special ended.
- **Save rate** = saved ÷ (saved + wasted). **Margin from specials** = Σ `portionsSold × (price − costPerPortion)`.
- Windows are rolling 7 / 30 days; trend buckets are Monday-start weeks (aggregation pipelines over `Special` and `WasteEvent`).

## AI providers

`AI_PROVIDER=mock` (default, deterministic, used by all tests) works with no key. `gemini` and `openai_compat` are written against the public API shapes but **were not exercised live** in development. To try one locally: set `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` (and `AI_BASE_URL` for openai_compat) in `.env`, restart the API and press _Suggest specials_. The AI only proposes dishes from ids it was given; the server discards unknown ids, non-positive quantities and ideas allowing fewer than 2 portions, retries once, then returns an error. Prices, margins and portions always come from the calculator.

## Testing

```bash
docker compose up -d && npm test        # API (Vitest + Supertest, real Mongo) and web (RTL)
npm run lint && npm run typecheck && npm run build
```

All tests run offline against the mock AI. CI (`.github/workflows/ci.yml`) runs lint, typecheck, test (Mongo service) and build.

## Deploy

See `docs/DEPLOY.md` (Atlas + Render + Vercel) and `docs/SETUP_CHECKLIST.md`.

## Known limitations

- **Auth:** short-lived JWT as a Bearer header kept in `sessionStorage`, no refresh cookie (chosen for speed with API and web on different domains). XSS would expose the token; the web app ships a strict CSP and never renders raw HTML.
- Hosted AI adapters (Gemini, OpenAI-compatible) were not run live.
- Planning aid only; not a food-safety system, no allergen data.
- Staff "invite" creates an account with a temporary password the owner shares; no email flow, password reset or user editing/removal.
- Dates are UTC days; no per-outlet time zones. No payment or billing code.
