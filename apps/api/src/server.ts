import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { logger } from './logger.js';

await connectDb(config.MONGODB_URI);
createApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
