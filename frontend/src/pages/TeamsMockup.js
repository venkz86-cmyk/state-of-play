import { Link } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

const PLANS = [
  {
    id: 'team-5',
    name: 'Team-5',
    seats: 5,
    base: '₹10,000',
    total: '₹11,800',
    perSeat: '₹2,000 + GST per seat',
    compare: 'At the current individual price of ₹2,499 + GST, five separate subscriptions would cost ₹12,495 + GST. Team-5 saves ₹2,495 before GST.',
    href: 'https://rzp.io/rzp/tsopteam5',
  },
  {
    id: 'team-10',
    name: 'Team-10',
    seats: 10,
    base: '₹20,000',
    total: '₹23,600',
    perSeat: '₹2,000 + GST per seat',
    compare: 'At the current individual price of ₹2,499 + GST, ten separate subscriptions would cost ₹24,990 + GST. Team-10 saves ₹4,990 before GST.',
    href: 'https://rzp.io/rzp/tsopteam10',
  },
];

const COVERAGE = ['franchise valuations', 'media rights', 'ownership deals'];

const USES = [
  'brief colleagues before a client or prospect meeting',
  'find the deal and market context behind the latest announcement',
  'check what was reported about a franchise, rights cycle, owner, investor or regulator',
  'give analysts and associates the same starting point',
  'return to a searchable archive of what actually happened, rather than rely on memory or the latest headline',
];

const TALK_TO_VENKAT_HREF = 'mailto:venkat@stateofplay.club?subject=Team%20plan%20%E2%80%94%20a%20quick%20question';

export const TeamsMockup = () => {
  return (
    <MockupLayout testId="mockup-teams" seo={{ title: 'Teams & Newsrooms', path: '/teams', description: 'Give your team a working view of Indian sport. Team plans for consulting and law firms, agencies, broadcasters, investors, analysts, franchises and operators.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">For Teams</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">Corporate plans</span>
        </div>
      </div>

      {/* A note from Venkat, not a funnel: the case, the offer and the price
          in one letter, ending with a signature, the way the rest of the
          site's editorial pages (see /about) already read. */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-8">
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.75rem] leading-[1.1] mb-8 max-w-[24ch]">
          A note for the desk <em className="italic font-normal">that needs this.</em>
        </h1>
        <div className="max-w-[65ch] space-y-5">
          <p className="font-editorial font-medium text-xl lg:text-[1.375rem] leading-snug tracking-tight text-[var(--text)]">
            A client asks what a franchise is worth, mid-pitch, with no time to reconstruct the deal history from press releases and old decks. By the time it reaches a general business publication, your team may already need a view.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            I write The State of Play, a weekly reported publication on the business of Indian sport: {COVERAGE.slice(0, -1).join(', ')} and {COVERAGE[COVERAGE.length - 1]}. 360 individual subscribers read it. The reporting has been cited by Bloomberg, SportBusiness, ESPNcricinfo, The Athletic and SportsPro.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            Consulting and law firms, agencies, broadcasters, investors, analysts, franchises and operators use it to {USES.slice(0, -1).join(', ')}, and {USES[USES.length - 1]}.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            It is a consistent source of reported facts, market context and analysis on a sector that is still poorly documented.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            A team plan puts the weekly story, the twice-weekly Left Field briefings and the full searchable archive in front of everyone on the desk who needs it. Each person gets their own sign-in. One administrator adds or removes people as the team changes, no re-signing and nothing lost when someone leaves.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            Team-5 is {PLANS[0].base} + GST a year ({PLANS[0].total} total), five seats at {PLANS[0].perSeat}. {PLANS[0].compare}
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            Team-10 is {PLANS[1].base} + GST a year ({PLANS[1].total} total), ten seats at {PLANS[1].perSeat}. {PLANS[1].compare}
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            Both come with a GST-compliant invoice. Need more than ten seats, or want to talk it through first? Email me at{' '}
            <a href={TALK_TO_VENKAT_HREF} className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors">
              venkat@stateofplay.club
            </a>.
          </p>
          <div data-testid="teams-pricing" className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
            {PLANS.map((p) => (
              <a
                key={p.id}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`teams-cta-${p.id}`}
                className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
              >
                Buy {p.name}
              </a>
            ))}
          </div>
          <p className="font-plex text-sm text-[var(--text-muted)] pt-1">
            Already subscribed?{' '}
            <Link to="/teams/login" className="text-[var(--accent-burgundy)] underline underline-offset-4" data-testid="teams-existing-customer-link">
              Go to your team account
            </Link>.
          </p>
        </div>
        <p className="font-editorial italic text-lg mt-10">Venkat Ananth</p>
      </section>
    </MockupLayout>
  );
};

export default TeamsMockup;
