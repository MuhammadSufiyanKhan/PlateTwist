import { config } from '../config.js';
import { GeminiProvider } from './gemini.js';
import { MockProvider } from './mock.js';
import { OpenAiCompatProvider } from './openaiCompat.js';
import type { AiProvider } from './types.js';

let override: AiProvider | null = null;
/** Test hook. */
export const setAiProvider = (p: AiProvider | null): void => {
  override = p;
};

export function getAiProvider(): AiProvider {
  if (override) return override;
  switch (config.AI_PROVIDER) {
    case 'gemini':
      return new GeminiProvider(config.AI_API_KEY, config.AI_MODEL);
    case 'openai_compat':
      return new OpenAiCompatProvider(config.AI_BASE_URL, config.AI_API_KEY, config.AI_MODEL);
    default:
      return new MockProvider();
  }
}
