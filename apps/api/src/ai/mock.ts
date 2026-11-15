import type { AiInput, AiOutput, AiProvider } from './types.js';

const SINGLE = ['Roasted {A} bowl', '{A} soup of the day', 'Crispy {A} flatbread'];
const PAIR = ['{A} and {B} skillet', '{B} and {A} salad', 'Slow-cooked {A} with {B}'];

const DEFAULT_QTY: Record<string, number> = { g: 180, ml: 120, pcs: 1 };

/** Deterministic provider: pairs top at-risk ingredients with dish templates. */
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async suggestSpecials(input: AiInput): Promise<AiOutput> {
    const items = input.atRisk;
    const staple = input.staples[0];
    const out: AiOutput['suggestions'] = [];
    const qtyFor = (a: AiInput['atRisk'][number]) => {
      const def = DEFAULT_QTY[a.unit] ?? 1;
      const cap = a.qty / 4;
      const q = Math.min(def, cap);
      return a.unit === 'pcs' ? Math.max(Math.round(q * 2) / 2, 0.5) : Math.max(Math.round(q), 1);
    };
    const withStaple = (arr: { ingredientId: string; qtyPerPortion: number }[]) =>
      staple
        ? [
            ...arr,
            { ingredientId: staple.ingredientId, qtyPerPortion: staple.unit === 'pcs' ? 1 : 8 },
          ]
        : arr;
    for (let i = 0; i < items.length && out.length < 5; i++) {
      const a = items[i]!;
      const b = items[i + 1];
      const tpl = b ? PAIR[i % PAIR.length]! : SINGLE[i % SINGLE.length]!;
      const lines = [{ ingredientId: a.ingredientId, qtyPerPortion: qtyFor(a) }];
      if (b && tpl.includes('{B}'))
        lines.push({ ingredientId: b.ingredientId, qtyPerPortion: qtyFor(b) });
      out.push({
        name: tpl.replace('{A}', a.name).replace('{B}', b?.name ?? ''),
        description: `Uses up ${a.name}${b && tpl.includes('{B}') ? ` and ${b.name}` : ''} before they run out of time.`,
        items: withStaple(lines),
      });
    }
    // Pad with single-ingredient variants so 3-5 suggestions come back when possible.
    for (let i = 0; i < items.length && out.length < 3; i++) {
      const a = items[i]!;
      const tpl = SINGLE[(i + 1) % SINGLE.length]!;
      out.push({
        name: tpl.replace('{A}', a.name),
        description: `A simple special built around ${a.name}.`,
        items: withStaple([{ ingredientId: a.ingredientId, qtyPerPortion: qtyFor(a) }]),
      });
    }
    return { suggestions: out };
  }
}
