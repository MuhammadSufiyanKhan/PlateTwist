import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BarChart3, ChefHat, Clock, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FOOD_NOTICE } from '../components/ui';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: Clock,
    title: 'See what is about to be wasted, ranked by money',
    body: 'Log batches with their expiry dates. The at-risk board ranks stock by value at risk, so the salmon expiring tomorrow outranks the rice expiring Friday. Expired use-by stock is never offered for sale.',
    points: [
      'Quantity × cost ÷ days left',
      'Urgency shown by label and icon',
      'Expired stock logged as waste automatically',
    ],
  },
  {
    icon: Sparkles,
    title: 'Get specials with the numbers already worked out',
    body: 'Pick the batches you want to use up and get three to five special ideas. Cost, suggested price, margin and portions are calculated by the app from your own costs and stock, never guessed by the AI.',
    points: [
      'Price rounded to your menu style',
      'Never more portions than the stock allows',
      'Run it with one tap, count sales with +1',
    ],
  },
  {
    icon: BarChart3,
    title: 'Prove the savings on a dashboard',
    body: 'End a special and the app records the stock value you saved and the value still wasted. Owners see every outlet; staff see their own. Watch the save rate climb week by week.',
    points: [
      'Saved vs wasted at cost, 7 and 30 days',
      'Top wasted ingredients',
      'Margin earned from specials',
    ],
  },
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-hero] > *', {
        y: 28,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.12,
      });
      gsap.from('[data-hero-card]', {
        y: 40,
        autoAlpha: 0,
        duration: 0.9,
        delay: 0.25,
        ease: 'power2.out',
      });
      gsap.utils.toArray<HTMLElement>('[data-feature]').forEach((el) => {
        gsap.from(el.querySelectorAll('[data-reveal]'), {
          y: 36,
          autoAlpha: 0,
          duration: 0.7,
          ease: 'power2.out',
          stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top 80%', once: true },
        });
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <p className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <ChefHat className="h-6 w-6" aria-hidden /> Specials Saver
        </p>
        <nav aria-label="Account" className="flex gap-2">
          <Link to="/login" className="btn-secondary">
            Sign in
          </Link>
          <Link to="/register" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div data-hero className="space-y-5">
            <p className="inline-block rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
              For restaurants and kitchens
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
              Turn near-expiry stock into specials that sell.
            </h1>
            <p className="text-lg text-ink-700">
              Log what is about to go off, get priced special ideas in seconds, and track exactly
              how much waste you saved.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary">
                Create your brand
              </Link>
              <Link to="/login" className="btn-secondary">
                Try the demo login
              </Link>
            </div>
          </div>
          <div data-hero-card className="card p-5" aria-label="Example of the at-risk board">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              At risk today
            </p>
            <ul className="mt-3 divide-y divide-ink-100 text-sm">
              {[
                ['Salmon fillet', 'Tomorrow', '$48.00'],
                ['Chicken thigh', 'Use today', '$66.00'],
                ['Spinach', 'Within 3 days', '$3.60'],
              ].map(([n, u, v]) => (
                <li key={n} className="flex items-center justify-between py-3">
                  <span className="font-semibold">{n}</span>
                  <span className="rounded-full border border-ink-300 px-2 py-0.5 text-xs">
                    {u}
                  </span>
                  <span className="font-bold">{v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
              <strong>Creamy salmon penne</strong> · 14 portions · $22.50 · 71% margin
            </div>
          </div>
        </div>
      </section>

      {FEATURES.map((f, i) => (
        <section
          key={f.title}
          data-feature
          className={i % 2 ? 'bg-ink-50' : 'bg-white'}
          aria-labelledby={`f-${i}`}
        >
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2">
            <div className={i % 2 ? 'md:order-2' : ''}>
              <f.icon data-reveal className="h-9 w-9 text-brand-600" aria-hidden />
              <h2
                data-reveal
                id={`f-${i}`}
                className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {f.title}
              </h2>
              <p data-reveal className="mt-3 text-ink-700">
                {f.body}
              </p>
            </div>
            <ul className="space-y-3">
              {f.points.map((p) => (
                <li
                  key={p}
                  data-reveal
                  className="card flex items-center gap-3 p-4 text-sm font-medium"
                >
                  <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="bg-brand-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Stop throwing money in the bin.</h2>
          <Link to="/register" className="btn mt-6 bg-white text-brand-800 hover:bg-brand-50">
            Get started
          </Link>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-500">{FOOD_NOTICE}</footer>
    </div>
  );
}
