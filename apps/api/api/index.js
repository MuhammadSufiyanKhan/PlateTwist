// Vercel serverless entry: serves the compiled Express app (built by `npm run build` into dist/).
import { config } from '../dist/config.js';
import { connectDb } from '../dist/db.js';
import { createApp } from '../dist/app.js';

const app = createApp();
let ready;

export default async function handler(req, res) {
  try {
    ready ??= connectDb(config.MONGODB_URI);
    await ready;
  } catch {
    ready = undefined;
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'DB_UNAVAILABLE', message: 'Database unavailable' } }));
    return;
  }
  return app(req, res);
}
