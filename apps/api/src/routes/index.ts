import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireOwner } from '../middleware/core.js';
import * as auth from '../controllers/auth.controller.js';
import * as catalog from '../controllers/catalog.controller.js';
import * as stock from '../controllers/stock.controller.js';
import * as special from '../controllers/special.controller.js';
import * as dash from '../controllers/dashboard.controller.js';

const limiter = (max: number, windowMs = 60_000) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
  });

export const router = Router();
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/auth/register', limiter(10), auth.register);
router.post('/auth/login', limiter(20), auth.loginCtl);

router.use(authenticate);
router.get('/auth/me', auth.me);

router.get('/users', requireOwner, auth.listUsers);
router.post('/users', requireOwner, auth.invite);
router.patch('/brand', requireOwner, auth.patchBrand);
router.get('/outlets', auth.listOutlets);
router.post('/outlets', requireOwner, auth.createOutlet);

router.get('/ingredients', catalog.listIngredients);
router.post('/ingredients', requireOwner, catalog.createIngredient);
router.patch('/ingredients/:id', requireOwner, catalog.patchIngredient);
router.delete('/ingredients/:id', requireOwner, catalog.removeIngredient);
router.get('/dishes', catalog.listDishes);
router.post('/dishes', requireOwner, catalog.createDish);
router.put('/dishes/:id', requireOwner, catalog.updateDish);
router.delete('/dishes/:id', requireOwner, catalog.removeDish);

router.get('/outlets/:outletId/at-risk', stock.atRisk);
router.get('/batches', stock.listBatches);
router.post('/batches', stock.postBatch);
router.get('/waste', stock.listWaste);
router.post('/waste', stock.postWaste);

router.get('/specials', special.list);
router.post('/specials', special.create);
router.get('/specials/:id', special.getOne);
router.post('/specials/:id/activate', special.activate);
router.post('/specials/:id/sold', special.sold);
router.post('/specials/:id/end', special.end);
router.post('/outlets/:outletId/suggestions', limiter(10), special.suggest);

router.get('/dashboard', dash.get);
