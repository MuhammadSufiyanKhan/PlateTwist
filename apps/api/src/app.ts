import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { errorHandler } from './middleware/core.js';
import { router } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  const allowed = config.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
      allowedHeaders: ['content-type', 'authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, autoLogging: config.NODE_ENV !== 'test' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', router);
  app.use((_req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );
  app.use(errorHandler);
  return app;
}
