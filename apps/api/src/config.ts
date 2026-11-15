import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/specials_saver'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  AI_PROVIDER: z.enum(['mock', 'gemini', 'openai_compat']).default('mock'),
  AI_MODEL: z.string().default(''),
  AI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().default(''),
  AI_DAILY_CAP_PER_BRAND: z.coerce.number().int().positive().default(50),
});

export type Config = z.infer<typeof schema>;
export const config: Config = schema.parse(process.env);
if (config.NODE_ENV === 'production' && config.JWT_SECRET.startsWith('dev-only')) {
  throw new Error('JWT_SECRET must be set in production');
}
