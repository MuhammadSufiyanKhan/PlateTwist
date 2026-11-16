/** Save-rate ring: saved ÷ (saved + wasted). Text alternative included. */
export function SaveRing({ rate, size = 168 }: { rate: number | null; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = rate === null ? 0 : Math.min(Math.max(rate, 0), 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={rate === null ? 'Save rate: no data yet' : `Save rate ${pct.toFixed(1)} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-ink-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-brand-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="money text-4xl text-ink-900">
          {rate === null ? '–' : `${pct.toFixed(0)}%`}
        </span>
        <span className="text-xs font-medium text-ink-500">of stock saved</span>
      </div>
    </div>
  );
}
