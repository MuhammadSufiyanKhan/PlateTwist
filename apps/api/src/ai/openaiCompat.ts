import { SYSTEM_PROMPT, userPrompt, type AiInput, type AiProvider } from './types.js';

/** Any OpenAI-compatible chat endpoint (Groq, etc.) in JSON mode. Not exercised live. */
export class OpenAiCompatProvider implements AiProvider {
  readonly name = 'openai_compat';
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    if (!baseUrl || !apiKey || !model)
      throw new Error('OpenAiCompatProvider needs AI_BASE_URL, AI_API_KEY and AI_MODEL');
  }

  async suggestSpecials(input: AiInput): Promise<unknown> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      throw new Error(`AI request failed with status ${res.status}: ${detail}`);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI returned no content');
    return JSON.parse(text) as unknown;
  }
}
