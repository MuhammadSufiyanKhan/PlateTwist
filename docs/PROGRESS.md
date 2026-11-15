# Progress

Start: Sun Nov 15 08:28 UTC 2026. Finished: 08:45 UTC (~17 min elapsed; far under the 5 h budget).

## Milestones
- [x] M1 Foundation: monorepo, compose, auth, tenancy/roles, seed (60 days), shell UI, tests
- [x] M2 Stock + at-risk board, ingredient/dish management, batch + waste logging
- [x] M3 Calculator + special lifecycle (FEFO, atomic allocation, rollback, end summary)
- [x] M4 AI suggestions (mock default; Gemini + OpenAI-compatible adapters), validation, cap, rate limit
- [x] M5 Dashboard (aggregation pipelines, pure metric functions)
- [x] M6 Landing (GSAP/ScrollTrigger), README, CI, Dockerfile, render.yaml, vercel.json, DEPLOY docs

## Cuts
None. Nothing from the section-11 cut list was needed.

## Final summary
**Works:** `docker compose up -d` + `npm run seed` gives the full demo flow for owner and staff (log batch → ranked at-risk → suggestions with computed price/margin → run → +1 sold → end → dashboard). 56 API tests (real Mongo, mock AI) and 6 web tests pass; lint, typecheck and build are clean. Screens checked at 360/768/1280 px with no horizontal overflow or console errors.

**Not verified / caveats:** Gemini and OpenAI-compatible adapters not run live. CI workflow not yet observed on GitHub. Deploy configs (Dockerfile, render.yaml, vercel.json) not exercised. Auth uses sessionStorage bearer tokens (documented limitation).

**You must do manually:** see `docs/SETUP_CHECKLIST.md` (Atlas, Render, Vercel, env vars, optional AI key, open a PR if wanted).
