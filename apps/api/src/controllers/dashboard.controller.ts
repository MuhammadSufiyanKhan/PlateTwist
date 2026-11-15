import { z } from 'zod';
import { parseId, validate, wrap } from '../middleware/core.js';
import { dashboard } from '../services/dashboard.service.js';

export const get = wrap(async (req, res) => {
  const q = validate(z.object({ outletId: z.string().optional() }), req.query);
  res.json(await dashboard(req.user, q.outletId ? parseId(q.outletId, 'Outlet') : undefined));
});
