import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatProvider, pickChatModel } from '../src/ai/openaiCompat.js';

const input = { atRisk: [], staples: [], catalog: [] };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('pickChatModel', () => {
  it('skips audio/guard models and prefers llama chat models', () => {
    expect(
      pickChatModel(['whisper-large-v3', 'llama-guard-4', 'llama-3.1-8b-instant', 'foo']),
    ).toBe('llama-3.1-8b-instant');
    expect(pickChatModel(['whisper-large-v3'])).toBeNull();
  });
});

describe('OpenAiCompatProvider', () => {
  it('discovers a working model when the configured one does not exist', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(url.replace('https://x.test/v1', ''));
        if (url.endsWith('/models'))
          return json(200, { data: [{ id: 'whisper-1' }, { id: 'llama-3.1-8b-instant' }] });
        const model = (JSON.parse(String(init?.body)) as { model: string }).model;
        if (model === 'gone')
          return json(404, {
            error: { message: 'The model `gone` does not exist', code: 'model_not_found' },
          });
        return json(200, { choices: [{ message: { content: '{"suggestions":[]}' } }] });
      }),
    );
    const p = new OpenAiCompatProvider('https://x.test/v1/', 'key', 'gone');
    await expect(p.suggestSpecials(input)).resolves.toEqual({ suggestions: [] });
    expect(calls).toEqual(['/chat/completions', '/models', '/chat/completions']);
    await p.suggestSpecials(input); // remembers the discovered model
    expect(calls.slice(3)).toEqual(['/chat/completions']);
  });

  it('surfaces other errors with the provider message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(401, { error: { message: 'Invalid API Key' } })),
    );
    const p = new OpenAiCompatProvider('https://x.test/v1', 'key', 'm');
    await expect(p.suggestSpecials(input)).rejects.toThrow(/401.*Invalid API Key/);
  });
});
