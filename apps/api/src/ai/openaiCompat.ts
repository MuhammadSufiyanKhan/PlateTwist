import { SYSTEM_PROMPT, userPrompt, type AiInput, type AiProvider } from './types.js';

const SKIP = /whisper|guard|tts|embed|vision|audio|moderation|transcribe|image|dall|rerank/i;
const PREFER = [/llama-3\.3/i, /llama-3\.1-8b/i, /llama/i, /gpt-oss/i, /qwen/i, /mixtral|gemma/i];

/** Pick a general chat model from an OpenAI-style /models listing. */
export function pickChatModel(ids: string[]): string | null {
  const usable = ids.filter((id) => !SKIP.test(id));
  for (const re of PREFER) {
    const hit = usable.find((id) => re.test(id));
    if (hit) return hit;
  }
  return usable[0] ?? null;
}

/** Any OpenAI-compatible chat endpoint (Groq, etc.) in JSON mode. */
export class OpenAiCompatProvider implements AiProvider {
  readonly name = 'openai_compat';
  private resolvedModel: string;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    model: string,
  ) {
    if (!baseUrl || !apiKey || !model)
      throw new Error('OpenAiCompatProvider needs AI_BASE_URL, AI_API_KEY and AI_MODEL');
    this.resolvedModel = model;
  }

  private get base(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  private async chat(input: AiInput, model: string): Promise<Response> {
    return fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  }

  /** If the configured model does not exist for this account, discover one from /models. */
  private async discoverModel(): Promise<string | null> {
    const res = await fetch(`${this.base}/models`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { id?: string }[] };
    return pickChatModel((body.data ?? []).flatMap((m) => (m.id ? [m.id] : [])));
  }

  async suggestSpecials(input: AiInput): Promise<unknown> {
    let res = await this.chat(input, this.resolvedModel);
    if (res.status === 404 || res.status === 400) {
      const detail = await res.clone().text();
      if (/model/i.test(detail)) {
        const alt = await this.discoverModel();
        if (alt && alt !== this.resolvedModel) {
          this.resolvedModel = alt;
          res = await this.chat(input, alt);
        }
      }
    }
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
