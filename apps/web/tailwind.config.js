/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  safelist: ['sticker-TODAY', 'sticker-TOMORROW', 'sticker-SOON', 'sticker-LATER'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        raised: v('raised'),
        danger: v('danger'),
        'danger-soft': v('danger-soft'),
        warn: v('warn'),
        'warn-soft': v('warn-soft'),
        label: v('label'),
        today: v('today'),
        'label-ink': v('label-ink'),
        brand: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, v(`brand-${n}`)]),
        ),
        ink: Object.fromEntries([50, 100, 300, 500, 700, 900].map((n) => [n, v(`ink-${n}`)])),
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: [
          '"Bricolage Grotesque Variable"',
          '"Figtree Variable"',
          'ui-sans-serif',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 6px 20px -8px rgb(var(--shadow) / 0.12)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.08), 0 18px 40px -14px rgb(var(--shadow) / 0.28)',
      },
    },
  },
  plugins: [],
};
