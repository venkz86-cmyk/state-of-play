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
    perSeat: '₹2,000 + GST per seat',
    compare: 'At the current individual price of ₹2,499 + GST, five separate subscriptions cost ₹12,495 + GST. Team-5 saves ₹2,495 before GST.',
    href: 'https://rzp.io/rzp/tsopteam5',
  },
  {
    id: 'team-10',
    name: 'Team-10',
    seats: 10,
    base: '₹20,000',
    total: '₹23,600',
    perSeat: '₹2,000 + GST per seat',
    compare: 'At the current individual price of ₹2,499 + GST, ten separate subscriptions cost ₹24,990 + GST. Team-10 saves ₹4,990 before GST.',
    href: 'https://rzp.io/rzp/tsopteam10',
  },
];

const COVERAGE = [
  'Franchise valuations', 'Broadcast and media rights', 'Ownership deals',
  'Governance', 'Retail', 'Gaming', 'Policy',
];

const USES = [
  'brief colleagues before a client or prospect meeting',
  'find the deal and market context behind the latest announcement',
  'check what was reported about a franchise, rights cycle, owner, investor or regulator',
  'give analysts and associates the same starting point',
  'return to a searchable archive of what actually happened, rather than rely on memory or the latest headline',
];

const INCLUDED = [
  ['The weekly State of Play deep dive', 'One reported story each week on the business of Indian sport. The focus is on how money moves, who controls the asset, what changed and what it means beyond the immediate news cycle.'],
  ['The Left Field briefings', 'Shorter briefings to keep the desk current between the deeper reported stories. Published twice a week.'],
  ['Full, searchable archive access', 'Every seat can search and read the archive. It becomes a working evidence base for past deals, valuations, rights cycles, ownership changes, policy decisions and market developments.'],
  ['Individual access for every colleague', 'Each team member gets a private login. Your administrator can add or remove members from the team dashboard.'],
  ['One account, one annual invoice', 'Centralised billing, self-serve team management and a GST-compliant invoice for the full subscription.'],
];

const FAQS = [
  ['How does team access work?', 'Choose a plan and pay once for the year. Use the team dashboard to add colleagues by email. Each person gets their own private login and access.'],
  ['Can we change team members?', 'Yes. Your administrator can add or remove members within the number of seats on the plan, from the team dashboard.'],
  ['Will we receive a GST invoice?', 'Yes. Team subscriptions include centralised billing and a GST-compliant invoice.'],
  ['Can we pay directly online?', 'Yes. Use the purchase link for Team-5 or Team-10 above.'],
  ['Can we speak before buying?', 'Yes. Email Venkat to discuss how the publication would fit your firm, desk or practice.'],
  ['What if we need more than 10 seats?', 'Ask about custom pricing for teams of 15 or more.'],
];

const TALK_TO_VENKAT_HREF = 'mailto:venkat@stateofplay.club?subject=Team%20plan%20%E2%80%94%20a%20quick%20question';

export const TeamsMockup = () => {
  const [open, setOpen] = useState(0);

  return (
    <MockupLayout testId="mockup-teams" seo={{ title: 'Teams & Newsrooms', path: '/teams', description: 'Give your team a working view of Indian sport. Team plans for consulting and law firms, agencies, broadcasters, investors, analysts, franchises and operators.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">For Teams</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">Corporate plans</span>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-12">
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.75rem] leading-[1.1] mb-5 max-w-[24ch]">
          Give your team <em className="italic font-normal">a working view</em> of Indian sport.
        </h1>
        <p className="font-plex text-base md:text-lg text-[var(--text-muted)] max-w-[60ch] leading-relaxed mb-8">
          The State of Play is a weekly reported publication on the business of Indian sport. Give up to ten colleagues the reporting, context and archive they need to follow deals, rights, ownership, policy and the people making the decisions.
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <a
            href="#choose-a-plan"
            data-testid="teams-hero-cta-primary"
            className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
          >
            Buy a team plan →
          </a>
          <a
            href={TALK_TO_VENKAT_HREF}
            data-testid="teams-hero-cta-secondary"
            className="font-plex text-base text-[var(--text)] underline underline-offset-[6px] decoration-1 hover:text-[var(--accent-burgundy)] transition-colors"
          >
            Talk to Venkat →
          </a>
        </div>
      </section>

      {/* Indian sport is now part of the work */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="font-editorial italic text-lg">Indian sport is now part of the work</p>
          </div>
          <div className="lg:col-span-8 space-y-5">
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch]">
              A client asks what a franchise is worth. A rights deal changes the assumptions behind a pitch. An ownership process begins. A policy decision moves a market. By the time the news reaches a general business publication, your team may already need a view.
            </p>
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch]">
              The State of Play reports on these shifts as they happen and keeps them in context. Coverage includes {COVERAGE.slice(0, -1).join(', ').toLowerCase()} and {COVERAGE[COVERAGE.length - 1].toLowerCase()}.
            </p>
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch]">
              It is written and reported by me, Venkat Ananth, from an India lens. Around 360 individual subscribers currently pay to read it. The reporting has been cited by Bloomberg, SportBusiness, ESPNcricinfo, The Athletic and SportsPro.
            </p>
            <p className="font-plex text-base leading-relaxed text-[var(--text)] max-w-[65ch]">
              A team plan puts that work in the hands of everyone who needs it, under one account and one invoice.
            </p>
          </div>
        </div>
      </section>

      {/* For the partner briefing a team before a client meeting */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="font-editorial italic text-lg">Before the client meeting</p>
          </div>
          <div className="lg:col-span-8 space-y-6">
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch]">
              You should not have to reconstruct the Indian sports market from press releases, search results and old pitch decks.
            </p>
            <div>
              <p className="font-plex text-sm text-[var(--text-label)] mb-3">Use The State of Play to:</p>
              <ul className="space-y-2.5">
                {USES.map((u) => (
                  <li key={u} className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[62ch] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-[var(--text-label)]">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch]">
              For consulting firms and agencies, this means less time assembling the background and more time deciding what it means for the client.
            </p>
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch]">
              This is reporting, not a consultancy retainer or a data terminal. It is a consistent source of reported facts, market context and analysis on a sector that is still poorly documented.
            </p>

            {/* Panel: before the meeting */}
            <div className="border border-[var(--rule)] p-6 lg:p-8 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <Overline className="!normal-case !tracking-normal !text-xs block mb-2">The question</Overline>
                  <p className="font-editorial text-base leading-snug">What has changed in this market, who is involved, and what does the client need to know?</p>
                </div>
                <div>
                  <Overline className="!normal-case !tracking-normal !text-xs block mb-2">The working material</Overline>
                  <p className="font-editorial text-base leading-snug">Weekly reported stories, shorter briefings and the full archive.</p>
                </div>
                <div>
                  <Overline className="!normal-case !tracking-normal !text-xs block mb-2">The result</Overline>
                  <p className="font-editorial text-base leading-snug">The people in the room begin with the same facts and context.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What your team gets */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">What your team gets</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 border-y border-[var(--rule)] py-8">
            {INCLUDED.map(([t, d], i) => (
              <div key={t}>
                <p className="font-plex text-xs text-[var(--text-muted)] tabular-nums mb-2">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-editorial font-medium text-lg mb-2">{t}</h3>
                <p className="font-plex text-sm leading-relaxed text-[var(--text-muted)] max-w-[48ch]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Choose a plan */}
      <section id="choose-a-plan" data-testid="teams-pricing" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12 scroll-mt-24">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">Choose a plan</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {PLANS.map((p) => (
              <div key={p.id} data-testid={`teams-plan-${p.id}`}>
                <h3 className="font-editorial font-medium text-2xl leading-tight mb-1">{p.name}</h3>
                <p className="font-plex text-sm text-[var(--text-muted)] mb-6">{p.seats} seats for your team</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="font-editorial font-semibold text-[2.75rem] lg:text-[3.5rem] leading-[0.9]">{p.base}</span>
                  <span className="font-plex text-sm text-[var(--text-muted)] pb-2">+ 18% GST / year</span>
                </div>
                <p className="font-plex text-[13px] text-[var(--text-label)] mb-1">{p.total} total · {p.perSeat}</p>
                <p className="font-plex text-sm leading-relaxed text-[var(--accent-burgundy)] max-w-[42ch] my-4">{p.compare}</p>
                <p className="font-plex text-xs text-[var(--text-muted)] mb-5">GST-compliant invoice included.</p>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`teams-cta-${p.id}`}
                  className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                >
                  Buy {p.name} →
                </a>
              </div>
            ))}
          </div>
          <p className="font-plex text-sm text-[var(--text-muted)] mt-10">
            Need more than 10 seats? Ask about pricing for teams of 15 or more —{' '}
            <a href={TALK_TO_VENKAT_HREF} className="text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1">talk to Venkat</a>.
          </p>
          <p className="font-plex text-sm text-[var(--text-muted)] mt-3">
            Already a customer?{' '}
            <a href="/teams/login" className="text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1" data-testid="teams-existing-customer-link">
              Access your dashboard →
            </a>
          </p>
        </div>
      </section>

      {/* Close */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8">
          <h2 className="font-editorial font-semibold tracking-tight text-[1.75rem] md:text-[2.25rem] leading-[1.15] mb-5 max-w-[28ch]">
            If your work touches Indian sport, <em className="italic font-normal">this is for the desk.</em>
          </h2>
          <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch] mb-8">
            The State of Play is built for consulting and law firms, agencies, broadcasters, investors, analysts, franchises and operators whose work depends on understanding the business around the game.
          </p>
          <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[65ch] mb-8">
            Buy a plan now, or speak to me if you want to know whether it fits your team.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <a
              href="#choose-a-plan"
              className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
            >
              Buy a team plan →
            </a>
            <a
              href={TALK_TO_VENKAT_HREF}
              className="font-plex text-base text-[var(--text)] underline underline-offset-[6px] decoration-1 hover:text-[var(--accent-burgundy)] transition-colors"
            >
              Talk to Venkat →
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4"><p className="font-editorial italic text-lg">FAQ</p></div>
          <div className="lg:col-span-8">
            <ul>
              {FAQS.map(([q, a], i) => (
                <li key={q} className="border-b border-[var(--rule)]">
                  <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="w-full py-5 flex items-start justify-between gap-6 text-left hover:text-[var(--accent)] transition-colors duration-200">
                    <span className="font-editorial font-medium text-lg leading-snug">{q}</span>
                    {open === i ? <Minus className="h-4 w-4 mt-2 shrink-0" strokeWidth={1.5} /> : <Plus className="h-4 w-4 mt-2 shrink-0" strokeWidth={1.5} />}
                  </button>
                  {open === i && <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed pb-6 max-w-[60ch]">{a}</p>}
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
