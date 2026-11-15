# Things only you can do

- [ ] Create a MongoDB Atlas cluster, DB user and network access (docs/DEPLOY.md §1).
- [ ] Create the Render service from `render.yaml` and set `MONGODB_URI`, `CORS_ORIGINS`.
- [ ] Create the Vercel project (root `apps/web`) and set `VITE_API_URL`.
- [ ] Put the final web URL into `CORS_ORIGINS` and redeploy the API.
- [ ] Optional: get a Gemini or OpenAI-compatible (e.g. Groq) API key, set `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` (+ `AI_BASE_URL`). These adapters were **not run live** here; try them locally first (README).
- [ ] Change or delete the demo accounts before using real data (never seed a production database).
- [ ] Open a pull request from the working branch if you want review/merge (none was opened).
