import mongoose from 'mongoose';
import { config } from '../config.js';
import { connectDb } from '../db.js';
import { DEMO_PASSWORD, DEMO_USERS, seedDemo } from './seed.js';

const started = Date.now();
await connectDb(config.MONGODB_URI);
await seedDemo();
await mongoose.disconnect();
console.log(
  `Seeded demo data in ${Date.now() - started} ms (existing data in this database was replaced).`,
);
console.log(`DEMO logins (password "${DEMO_PASSWORD}"): ${Object.values(DEMO_USERS).join(', ')}`);
