import { useState } from 'react';
import { ArrowUpRight, Plus, Minus } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const PLANS = [
  {
    id: 'team-5',
    name: 'Team-5',
    seats: 5,
    price: '₹10,000',
    perSeat: '₹2,000',
    save: 'Save ₹2,495 vs individual subscriptions',
    badge: 'Founding Rate',
    highlight: false,
  },
  {
    id: 'team-10',
    name: 'Team-10',
    seats: 10,
    price: '₹20,000',
    perSeat: '₹2,000',
    save: 'Save ₹4,990 vs individual subscriptions',
    badge: 'Most Popular',
    highlight: true,
  },
];

const AUDIENCES = [
  ['IPL Franchises', 'Track competitor deals, benchmark valuations, inform M&A strategy.'],
  ['Sports Agencies', 'Brief clients on market trends, identify partnership opportunities.'],
  ['VC / PE Funds', 'Deal flow intelligence, sector analysis, investment thesis development.'],
];

const FEATURES = [
  'Weekly TSOP deep dive',
  'Bi-weekly Left Field briefs',
  'Full archive access',
  'Breaking news alerts',
  'Centralised billing',
  'GST-compliant invoicing',
  'Self-serve team management',
  'Priority email support',
];

const FAQS = [
  ['How does team access work?', 'You pay for a fixed number of seats, then use our dashboard to add team members by email. Each member gets a Ghost login link to access all content.'],
  ['Can we add or remove members?', 'Yes — use the team dashboard to add or remove members at any time. Changes take effect immediately.'],
  ['What payment methods do you accept?', 'All major credit/debit cards and UPI via Razorpay. International customers can pay via card.'],
  ['How does renewal work?', 'Founding customers who sign up before June 30, 2026 get Year 1 at the founding rate, then a gentle increase in Year 2 (still below standard pricing).'],
];

const scrollToPricing = () =>
  document.querySelector('[data-testid="teams-pricing"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export const TeamsMockup = () => {
  const [open, setOpen] = useState(0);

  return (
    <MockupLayout testId="mockup-teams">
      {/* Hero */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <Overline className="text-[#234ba0] mb-5 block">— For Teams —</Overline>
            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[5rem] leading-[1] mb-6">
              The State of Play,{' '}
              <em className="italic font-normal text-[#234ba0]">for the whole desk.</em>
            </h1>
            <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] max-w-[55ch] leading-relaxed">
              One subscription, your whole team stays informed. Volume pricing, centralised management, GST-compliant invoicing.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col lg:items-end gap-5">
            <button
              type="button"
              onClick={scrollToPricing}
              data-testid="teams-hero-pricing"
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              View plans
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <a
              href="mailto:venkat@stateofplay.club?subject=Corporate Subscription Inquiry"
              className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200"
            >
              Contact sales
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        data-testid="teams-pricing"
        className="border-b border-[#E2E8F0] dark:border-[#1E293B]"
      >
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <Overline className="text-[#234ba0] mb-3 block">— Pricing —</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-12">
            Two plans. One desk.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E2E8F0] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B]">
            {PLANS.map((p) => (
              <div
                key={p.id}
                data-testid={`teams-plan-${p.id}`}
                className={`bg-[#F7F7F5] dark:bg-[#090E17] p-8 lg:p-12 ${p.highlight ? 'lg:bg-[#0F172A] lg:text-white' : ''}`}
              >
                <div className="flex items-center gap-3 mb-8">
                  <Overline className={p.highlight ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}>
                    {p.badge}
                  </Overline>
                </div>

                <h3 className={`font-editorial font-semibold text-3xl lg:text-[2.5rem] leading-tight mb-2 ${p.highlight ? 'text-white' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                  {p.name}
                </h3>
                <p className={`font-plex text-sm mb-8 ${p.highlight ? 'text-white/70' : 'text-[#475569] dark:text-[#94A3B8]'}`}>
                  {p.seats} seats for your team
                </p>

                <div className="flex items-end gap-2 mb-2">
                  <span className={`font-editorial font-semibold tracking-tight text-[3.5rem] lg:text-[5rem] leading-[0.9] ${p.highlight ? 'text-white' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                    {p.price}
                  </span>
                  <span className={`font-plex text-sm pb-3 ${p.highlight ? 'text-white/60' : 'text-[#475569] dark:text-[#94A3B8]'}`}>
                    + GST / year
                  </span>
                </div>
                <p className={`font-plex text-sm mb-2 ${p.highlight ? 'text-white/60' : 'text-[#475569]'}`}>
                  {p.perSeat} per seat <span className="text-[var(--accent)]">(20% off individual)</span>
                </p>
                <Overline className={`block mb-10 ${p.highlight ? '!text-[var(--accent)]' : '!text-[#234ba0]'}`}>
                  {p.save}
                </Overline>

                <button
                  type="button"
                  className={`w-full inline-flex items-center justify-center gap-2 font-plex font-semibold px-8 py-4 text-base transition-colors duration-200 ${
                    p.highlight
                      ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
                      : 'bg-[#0F172A] dark:bg-[#F8FAFC] text-white dark:text-[#090E17] hover:bg-[#234ba0] dark:hover:bg-[#234ba0] dark:hover:text-white'
                  }`}
                >
                  Get started
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                </button>
                <p className={`font-plex-mono text-[11px] tracking-[0.22em] uppercase mt-5 ${p.highlight ? 'text-white/50' : 'text-[#94A3B8]'}`}>
                  Standard rate from July 1: {p.id === 'team-5' ? '₹12,500' : '₹22,500'} + GST
                </p>
              </div>
            ))}
          </div>

          <p className="font-plex text-base text-[#475569] dark:text-[#94A3B8] text-center mt-10">
            Larger teams? Custom pricing for 15+ seats —{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-[#234ba0] underline underline-offset-4">
              get in touch
            </a>.
          </p>
        </div>
      </section>

      {/* Audiences */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <Overline className="text-[#234ba0] mb-3 block">— Who It’s For —</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-12">
            Who reads us together.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-[#E2E8F0] dark:lg:divide-[#1E293B] border-y border-[#E2E8F0] dark:border-[#1E293B]">
            {AUDIENCES.map(([title, desc], i) => (
              <div key={title} className="py-10 lg:py-12 lg:px-10 first:lg:pl-0 last:lg:pr-0">
                <Overline className="text-[var(--accent)] mb-4 block">
                  {String(i + 1).padStart(2, '0')} —
                </Overline>
                <h3 className="font-editorial font-semibold text-2xl lg:text-[1.75rem] leading-tight text-[#0F172A] dark:text-[#F8FAFC] mb-3">
                  {title}
                </h3>
                <p className="font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] max-w-[40ch]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <Overline className="text-[#234ba0] mb-3 block">— What’s Included —</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-12">
            Everything we publish.
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-5 border-y border-[#0F172A]/10 dark:border-[#F8FAFC]/10 py-8">
            {FEATURES.map((f, i) => (
              <li key={f} className="flex items-baseline gap-3">
                <span className="font-plex-mono text-[10px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-editorial text-base lg:text-lg text-[#0F172A] dark:text-[#F8FAFC]">
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <Overline className="text-[#234ba0] mb-3 block">— FAQ —</Overline>
              <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                Briefly answered.
              </h2>
            </div>
            <div className="lg:col-span-8">
              <ul className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
                {FAQS.map(([q, a], i) => (
                  <li key={q} className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
                    <button
                      type="button"
                      onClick={() => setOpen(open === i ? -1 : i)}
                      className="w-full py-6 flex items-start justify-between gap-6 text-left hover:text-[#234ba0] transition-colors duration-200"
                      data-testid={`teams-faq-${i}`}
                    >
                      <span className="font-editorial font-semibold text-xl lg:text-[1.5rem] leading-snug">
                        {q}
                      </span>
                      {open === i ? <Minus className="h-5 w-5 mt-2 shrink-0" strokeWidth={1.5} /> : <Plus className="h-5 w-5 mt-2 shrink-0" strokeWidth={1.5} />}
                    </button>
                    {open === i && (
                      <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] leading-relaxed pb-7 max-w-[60ch]">
                        {a}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <Overline className="text-[var(--accent)] mb-5 block">For Teams</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3.5rem] leading-[1.05]">
              Ready to upgrade your team?
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 lg:items-end">
            <button
              type="button"
              onClick={scrollToPricing}
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              View plans
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <a
              href="mailto:venkat@stateofplay.club?subject=Corporate Subscription Inquiry"
              className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
            >
              Talk to us
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default TeamsMockup;
