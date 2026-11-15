import { SYSTEM_PROMPT, userPrompt, type AiInput, type AiProvider } from './types.js';

/** Google Gemini via generateContent with JSON-schema structured output. Not exercised live. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    if (!apiKey || !model) throw new Error('GeminiProvider needs AI_API_KEY and AI_MODEL');
  }

  async suggestSpecials(input: AiInput): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              suggestions: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    description: { type: 'STRING' },
                    items: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          ingredientId: { type: 'STRING' },
                          qtyPerPortion: { type: 'NUMBER' },
                        },
                        required: ['ingredientId', 'qtyPerPortion'],
                      },
                    },
                  },
                  required: ['name', 'description', 'items'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      throw new Error(`Gemini request failed with status ${res.status}: ${detail}`);
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no content');
    return JSON.parse(text) as unknown;
  }
}
