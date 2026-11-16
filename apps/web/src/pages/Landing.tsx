import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/AppShell';
import { SaveRing } from '../components/SaveRing';
import { ThemeToggle } from '../components/ThemeToggle';
import { FOOD_NOTICE, UrgencyBadge } from '../components/ui';
import type { Urgency } from '../api/types';

gsap.registerPlugin(ScrollTrigger);

const TICKETS: { name: string; detail: string; value: string; urgency: Urgency }[] = [
  { name: 'Chicken thigh', detail: '2.7 kg, use by today', value: '$66.00', urgency: 'TODAY' },
  {
    name: 'Salmon fillet',
    detail: '1.5 kg, use by tomorrow',
    value: '$48.00',
    urgency: 'TOMORROW',
  },
  { name: 'Spinach', detail: '1.2 kg, 3 days left', value: '$3.60', urgency: 'SOON' },
];

const STEPS = [
  {
    title: 'Log what you have',
    body: 'Add each delivery with its expiry date. The board ranks stock by money at risk, so a tray of salmon outranks a sack of rice.',
  },
  {
    title: 'Run a priced special',
    body: 'Pick the batches to use up and get three to five ideas. Cost, price, margin and portions are worked out from your own costs and stock.',
  },
  {
    title: 'See what you saved',
    body: 'Tap +1 for each sale and end the special at close. The dashboard shows stock saved against stock wasted, week by week.',
  },
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [rate, setRate] = useState(0);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // One orchestrated moment: the kitchen printer prints the tickets.
      gsap.from('[data-print]', {
        yPercent: -60,
        autoAlpha: 0,
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.28,
        delay: 0.25,
      });
      gsap.from('[data-hero-copy]', {
        autoAlpha: 0,
        y: 14,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.08,
      });
      // The save-rate ring counts up once when it scrolls into view.
      const counter = { v: 0 };
      ScrollTrigger.create({
        trigger: '[data-proof]',
        start: 'top 75%',
        once: true,
        onEnter: () =>
          gsap.to(counter, {
            v: 81,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => setRate(counter.v),
          }),
      });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => setRate(81));
    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link to="/login" className="btn-secondary">
            Sign in
          </Link>
          <Link to="/register" className="btn-primary">
            Create account
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div>
          <h1
            data-hero-copy
            className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl"
          >
            Sell it before you bin it.
          </h1>
          <p data-hero-copy className="mt-5 max-w-md text-lg leading-relaxed text-ink-700">
            Log the stock that is about to expire, get priced specials in seconds, and see exactly
            how much waste you saved.
          </p>
          <div data-hero-copy className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary h-12 px-6 text-base">
              Create your account
            </Link>
            <Link to="/login" className="btn-secondary h-12 px-6 text-base">
              Sign in
            </Link>
          </div>
          <p data-hero-copy className="mt-4 max-w-md text-sm text-ink-500">
            A planning aid for kitchens, not a food-safety system.
          </p>
        </div>

        <div aria-label="Example of the at-risk board" className="relative">
          <div
            aria-hidden
            className="mx-auto mb-3 h-3 w-[92%] rounded-full bg-[rgb(var(--rail))] shadow-lift"
          />
          <ul className="mx-auto w-[96%] space-y-3">
            {TICKETS.map((t, i) => (
              <li
                key={t.name}
                data-print
                className={`ticket ${i % 2 ? 'rotate-[0.8deg]' : '-rotate-[0.6deg]'}`}
              >
                <div className="ticket-stub p-0">
                  <UrgencyBadge urgency={t.urgency} stub />
                </div>
                <div className="ticket-body flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">{t.name}</p>
                    <p className="text-sm text-ink-500">{t.detail}</p>
                  </div>
                  <p className="money text-xl">{t.value}</p>
                </div>
              </li>
            ))}
            <li data-print className="card bg-label p-4 text-label-ink">
              <p className="text-sm font-semibold">Suggested special</p>
              <p className="font-display text-xl font-extrabold">Creamy salmon penne</p>
              <p className="text-sm">14 portions. $22.50 each. 71% margin.</p>
            </li>
          </ul>
          <p className="mt-3 text-center text-xs text-ink-500">Example data</p>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-surface" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2
            id="how"
            className="max-w-xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            From the walk-in to the menu in three steps
          </h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="ticket">
                <div
                  className="ticket-stub bg-brand-600 text-white"
                  style={{ ['--stub' as string]: '4rem' }}
                >
                  <span className="font-display text-3xl font-extrabold">{i + 1}</span>
                </div>
                <div className="ticket-body">
                  <h3 className="font-display text-lg font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-700">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section data-proof className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="proof">
        <div className="card flex flex-col items-center gap-8 p-8 md:flex-row md:gap-14">
          <SaveRing rate={rate} size={200} />
          <div>
            <h2
              id="proof"
              className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
            >
              Proof, not guesswork
            </h2>
            <p className="mt-3 max-w-lg text-ink-700">
              Every special that ends adds to the saved column. Every expired batch and waste entry
              adds to the wasted one. Owners see every outlet; staff see their own.
            </p>
            <p className="mt-3 text-xs text-ink-500">
              Example figure from the demo data, not a customer result.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{FOOD_NOTICE}</p>
          <Link to="/register" className="btn-primary self-start">
            Create your account
          </Link>
        </div>
      </footer>
    </div>
  );
}
