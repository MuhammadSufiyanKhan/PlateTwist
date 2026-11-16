import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemePref } from '../lib/theme';

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { pref, setPref } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex rounded-xl border border-ink-300 bg-surface p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => setPref(value)}
          className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition ${
            pref === value
              ? 'bg-brand-600 text-white'
              : 'text-ink-500 hover:bg-raised hover:text-ink-900'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
