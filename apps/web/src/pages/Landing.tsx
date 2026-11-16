import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BarChart3,
  Calculator,
  ChefHat,
  ChevronDown,
  Layers,
  PackagePlus,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
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
    body: 'Add each delivery with its quantity and expiry date, in kilos, litres, pieces or dozens. The board ranks your stock by the money at risk, so a tray of salmon outranks a sack of rice.',
  },
  {
    title: 'Run a priced special',
    body: 'Pick the batches you want to use up and get three to five ideas. Cost, price, margin and the number of portions are worked out from your own costs and the stock you really have.',
  },
  {
    title: 'See what you saved',
    body: 'Tap +1 for every sale and end the special at close. Unsold stock goes back to inventory, and the dashboard shows stock saved against stock wasted, week by week.',
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: PackagePlus,
    title: 'Fast stock logging',
    body: 'Record a batch in a few taps from a phone in the kitchen. Choose use-by or best-before, and the app converts units to grams, millilitres and pieces for you.',
  },
  {
    icon: ChefHat,
    title: 'Specials from your own menu',
    body: 'Start from a dish in your catalog or from an idea the AI proposes. Either way the recipe is checked against stock before anything is promised.',
  },
  {
    icon: Calculator,
    title: 'Prices worked out by the app',
    body: 'Portion cost includes staples like oil and salt. The suggested price hits your target margin and rounds up to your price step. The AI never sets a number.',
  },
  {
    icon: Layers,
    title: 'Oldest stock goes first',
    body: 'When a special starts, the app reserves stock from the batches that expire first. If anything changes mid-way, the reservation is rolled back instead of leaving a mess.',
  },
  {
    icon: Trash2,
    title: 'Waste you can see',
    body: 'Expired use-by stock becomes a waste record automatically, and you can log spoilage by hand. Nothing past its use-by date is ever offered for a special.',
  },
  {
    icon: BarChart3,
    title: 'A dashboard that adds it up',
    body: 'Saved and wasted value over 7 and 30 days, save rate, a weekly trend, your most-wasted ingredients and the margin earned from specials.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is this a food-safety system?',
    a: 'No. Specials Saver is a planning aid. It helps you decide what to sell first, but it does not replace your own food-safety procedures. Always check allergens with the kitchen before serving.',
  },
  {
    q: 'Who works out the prices and margins?',
    a: 'The app does, from your ingredient costs. Portion cost comes from the recipe, the suggested price is cost divided by one minus your target margin, rounded up to your price step. The AI only proposes dishes.',
  },
  {
    q: 'What does “saved” mean?',
    a: 'Saved is the cost of the stock used by portions you actually sold. Wasted is the cost of stock that expired or that you logged as waste. Save rate is saved divided by saved plus wasted.',
  },
  {
    q: 'Do I need an AI account?',
    a: 'No. A built-in idea generator works out of the box. If you connect a hosted AI service, suggestions come from there instead, and the numbers are still calculated by the app.',
  },
  {
    q: 'Can I run more than one outlet?',
    a: 'Yes. A brand can have several outlets. Owners see every outlet and the combined dashboard; staff only see the outlets they are assigned to.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes. Logging stock, recording sales with a large +1 button and checking the at-risk board are designed for a phone in a busy kitchen. The app has light and dark themes.',
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
      <header className="sticky top-0 z-30 border-b border-transparent bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Logo />
          <nav
            aria-label="Sections"
            className="hidden items-center gap-6 text-sm font-semibold text-ink-700 md:flex"
          >
            <a href="#how" className="hover:text-brand-700">
              How it works
            </a>
            <a href="#features" className="hover:text-brand-700">
              Features
            </a>
            <a href="#teams" className="hover:text-brand-700">
              For your team
            </a>
            <a href="#faq" className="hover:text-brand-700">
              Questions
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link to="/login" className="btn-secondary">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary hidden sm:inline-flex">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div>
          <h1
            data-hero-copy
            className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl"
          >
            Sell it before you bin it.
          </h1>
          <p data-hero-copy className="mt-5 max-w-lg text-lg leading-relaxed text-ink-700">
            Every kitchen throws away food that could have been a special. Specials Saver shows
            which stock is about to expire, suggests dishes that use it up, prices them to protect
            your margin, and counts exactly how much waste you saved.
          </p>
          <div data-hero-copy className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary h-12 px-6 text-base">
              Create your account
            </Link>
            <a href="#how" className="btn-secondary h-12 px-6 text-base">
              See how it works
            </a>
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

      <section className="border-y border-ink-100 bg-surface" aria-labelledby="problem">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1fr_1.2fr] md:items-start">
          <h2
            id="problem"
            className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            The waste is rarely a mystery. It is a timing problem.
          </h2>
          <div className="space-y-4 text-ink-700">
            <p className="leading-relaxed">
              Stock gets ordered, delivered and shelved. A few days later someone notices the date.
              By then the only option is the bin, and the cost lands in the wasted-food line nobody
              likes to look at.
            </p>
            <p className="leading-relaxed">
              The fix is to see it sooner and decide faster: which batch is worth the most, how many
              portions it can make, and what to charge. Specials Saver puts those three answers on
              one screen.
            </p>
          </div>
        </div>
      </section>

      <section
        id="how"
        className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16"
        aria-labelledby="how-h"
      >
        <h2
          id="how-h"
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
      </section>

      <section
        id="features"
        className="scroll-mt-20 border-y border-ink-100 bg-surface"
        aria-labelledby="feat-h"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2
            id="feat-h"
            className="max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            Everything a kitchen needs to turn near-expiry stock into sales
          </h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="teams"
        className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16"
        aria-labelledby="teams-h"
      >
        <h2
          id="teams-h"
          className="max-w-xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
        >
          One app for the owner and the kitchen
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-label text-label-ink">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-xl font-bold">For owners</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700">
              <li>See every outlet at once, or compare them side by side.</li>
              <li>Set ingredient costs, dishes, your target margin and price rounding.</li>
              <li>Invite staff and choose which outlets they can use.</li>
              <li>Track saved and wasted value, save rate and the margin earned from specials.</li>
            </ul>
          </article>
          <article className="card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-label text-label-ink">
              <Smartphone className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-xl font-bold">For kitchen staff</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700">
              <li>Log deliveries and waste from a phone, with large touch targets.</li>
              <li>
                Open the at-risk board to see what to use first, with urgency shown by label and
                icon.
              </li>
              <li>Run a suggested special and tap +1 for every sale.</li>
              <li>End the special at close and see what it saved.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-surface" aria-labelledby="trust-h">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <h2
              id="trust-h"
              className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
            >
              Numbers you can check
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-ink-700">
              Money is never left to guesswork or to an AI. Every figure on screen comes from a
              simple rule you can verify with a calculator.
            </p>
          </div>
          <dl className="space-y-4">
            {[
              [
                'Value at risk',
                'Quantity × cost per unit ÷ days left, with a minimum of half a day. It ranks the board.',
              ],
              ['Portion cost', 'Every ingredient in the recipe at your cost, staples included.'],
              [
                'Suggested price',
                'Portion cost ÷ (1 − target margin), rounded up to your price step.',
              ],
              [
                'Portions possible',
                'The most you can make from the eligible stock you really have, never more.',
              ],
              ['Save rate', 'Saved ÷ (saved + wasted).'],
            ].map(([term, def]) => (
              <div key={term} className="rounded-2xl border border-ink-100 bg-raised p-4">
                <dt className="font-display font-bold">{term}</dt>
                <dd className="mt-0.5 text-sm text-ink-700">{def}</dd>
              </div>
            ))}
          </dl>
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
              adds to the wasted one. Watch the save rate climb as your team gets quicker at
              spotting what to sell.
            </p>
            <p className="mt-3 text-xs text-ink-500">
              Example figure from the demo data, not a customer result.
            </p>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-20 border-y border-ink-100 bg-surface"
        aria-labelledby="faq-h"
      >
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2
            id="faq-h"
            className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            Questions kitchens ask
          </h2>
          <div className="mt-8 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-bg">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold">
                  {f.q}
                  <ChevronDown
                    className="h-5 w-5 shrink-0 transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 leading-relaxed text-ink-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[rgb(var(--rail))] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Stop throwing money in the bin.
            </h2>
            <p className="mt-2 max-w-md text-[rgb(var(--rail-ink))]">
              Create your account, add your ingredients and log tonight’s stock. Your first special
              is a few taps away.
            </p>
          </div>
          <Link
            to="/register"
            className="btn bg-label px-6 text-base text-label-ink hover:brightness-105"
          >
            Create your account
          </Link>
        </div>
      </section>

      <footer className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{FOOD_NOTICE}</p>
          <p>
            <Link to="/login" className="font-semibold text-brand-700 underline">
              Sign in
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
