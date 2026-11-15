import { afterAll, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';

process.env.NODE_ENV = 'test';
beforeAll(async () => {
  await connectDb(process.env.MONGODB_URI_TEST ?? 'mongodb://localhost:27017/specials_test');
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});
afterAll(async () => {
  await mongoose.disconnect();
});
