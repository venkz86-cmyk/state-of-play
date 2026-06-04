import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const PLANS = [
  {
    id: 'team-5',
    name: 'Team-5',
    seats: 5,
    base: '₹10,000',
    total: '₹11,800',
    perSeat: '₹2,000 + GST per seat (₹2,360 total)',
    save: 'Save ₹2,035 vs individual (before GST)',
    badge: 'Founding rate',
    href: 'https://rzp.io/rzp/tsopteam5',
  },
  {
    id: 'team-10',
    name: 'Team-10',
    seats: 10,
    base: '₹20,000',
    total: '₹23,600',
    perSeat: '₹2,000 + GST per seat (₹2,360 total)',
    save: 'Save ₹4,990 vs individual (before GST)',
    badge: 'Best value',
    href: 'https://rzp.io/rzp/tsopteam10',
  },
];

const AUDIENCES = [
  ['IPL Franchises', 'Track competitor deals, benchmark valuations, inform M&A strategy.'],
  ['Sports Agencies', 'Brief clients on market trends, identify partnership opportunities.'],
  ['VC / PE Funds', 'Deal flow intelligence, sector analysis, investment thesis.'],
];

const FEATURES = [
  'Weekly TSOP deep dive', 'Bi-weekly Left Field briefs', 'Full archive access',
  'Members-only events', 'Centralised billing', 'GST-compliant invoicing',
  'Self-serve team management', 'Priority email support',
];

const FAQS = [
  ['How does team access work?', 'You pay for a fixed number of seats, then use our dashboard to add team members by email. Each member gets a private login link by email.'],
  ['Can we add or remove members?', 'Yes — use the team dashboard at any time. Changes take effect immediately.'],
  ['What payment methods do you accept?', 'All major credit/debit cards and UPI via Razorpay. International customers can pay via card.'],
  ['How does renewal work?', 'Founding customers who sign up before June 30, 2026 get Year 1 at the founding rate, then a gentle increase in Year 2.'],
];

export const TeamsMockup = () => {
  const [open, setOpen] = useState(0);

  return (
    <MockupLayout testId="mockup-teams">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">For Teams</Overline>
          <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">Corporate plans</span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-12">
        <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem] leading-[1.05] mb-6 max-w-[24ch]">
          The State of Play, <em className="italic font-normal">for the whole desk.</em>
        </h1>
        <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] max-w-[55ch] leading-relaxed">
          One subscription, your whole team stays informed. Volume pricing, centralised management, GST-compliant invoicing.
        </p>
      </section>

      {/* Pricing */}
      <section data-testid="teams-pricing" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
          <p className="font-editorial italic text-lg mb-8">Two plans. One desk.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {PLANS.map((p) => (
              <div key={p.id} data-testid={`teams-plan-${p.id}`}>
                <Overline className="!normal-case !tracking-normal !text-sm block mb-3">{p.badge}</Overline>
                <h3 className="font-editorial font-medium text-2xl leading-tight mb-1">{p.name}</h3>
                <p className="font-plex text-sm text-[var(--text-muted)] mb-6">{p.seats} seats for your team</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="font-editorial font-semibold text-[2.75rem] lg:text-[3.5rem] leading-[0.9]">{p.base}</span>
                  <span className="font-plex text-sm text-[var(--text-muted)] pb-2">+ 18% GST / year</span>
                </div>
                <p className="font-plex text-[13px] text-[#666666] mb-4">{p.total} / year total</p>
                <p className="font-plex text-sm text-[var(--text-muted)] mb-1">{p.perSeat}</p>
                <p className="font-plex text-xs text-[var(--accent-burgundy)] mb-5">{p.save}</p>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`teams-cta-${p.id}`}
                  className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                >
                  Get started →
                </a>
              </div>
            ))}
          </div>
          <p className="font-plex text-sm text-[var(--text-muted)] mt-10">
            Larger teams? Custom pricing for 15+ seats:{' '}
            <a href="mailto:prerna@stateofplay.club?subject=Custom%20team%20pricing%20%E2%80%94%2015%2B%20seats" className="text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1">get in touch</a>.
          </p>
        </div>
      </section>

      {/* Audiences */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
          <p className="font-editorial italic text-lg mb-6">Who reads us together</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8">
            {AUDIENCES.map(([t, d], i) => (
              <div key={t}>
                <p className="font-plex text-xs text-[#94A3B8] tabular-nums mb-2">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-editorial font-medium text-lg mb-2">{t}</h3>
                <p className="font-plex text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
          <p className="font-editorial italic text-lg mb-6">What’s included</p>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 border-y border-[#E2E8F0] dark:border-[#1E293B] py-6">
            {FEATURES.map((f, i) => (
              <li key={f} className="flex items-baseline gap-3">
                <span className="font-plex text-xs text-[#94A3B8] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-editorial text-base">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4"><p className="font-editorial italic text-lg">FAQ</p></div>
          <div className="lg:col-span-8">
            <ul>
              {FAQS.map(([q, a], i) => (
                <li key={q} className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
                  <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="w-full py-5 flex items-start justify-between gap-6 text-left hover:text-[var(--accent)] transition-colors duration-200">
                    <span className="font-editorial font-medium text-lg leading-snug">{q}</span>
                    {open === i ? <Minus className="h-4 w-4 mt-2 shrink-0" strokeWidth={1.5} /> : <Plus className="h-4 w-4 mt-2 shrink-0" strokeWidth={1.5} />}
                  </button>
                  {open === i && <p className="font-plex text-base text-[#475569] dark:text-[#94A3B8] leading-relaxed pb-6 max-w-[60ch]">{a}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default TeamsMockup;
