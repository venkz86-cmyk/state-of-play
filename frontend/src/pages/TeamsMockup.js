import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';

const PLANS = [
  {
    id: 'team-5',
    name: 'Team-5',
    body: '₹10,000 + GST a year (₹11,800 total). Five seats, ₹2,000 + GST each. Five separate subscriptions would cost ₹12,495. You save ₹2,495.',
  },
  {
    id: 'team-10',
    name: 'Team-10',
    body: '₹20,000 + GST a year (₹23,600 total). Ten seats, ₹2,000 + GST each. Ten separate subscriptions would cost ₹24,990. You save ₹4,990.',
  },
];

export const TeamsMockup = () => {
  const [paidPlan, setPaidPlan] = useState(null);
  const [openPlan, setOpenPlan] = useState(null);
  const [companyName, setCompanyName] = useState('');

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
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            A client asks what a franchise is worth, mid-pitch, with no time to reconstruct the deal history from press releases and old decks. By the time it reaches a general business publication, your team already needs a view.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            I write The State of Play, a weekly reported publication on the business of Indian sport: franchise valuations, media rights, ownership. One deeply reported story a week. No scores, no opinion, no noise. In its first year, 360 readers have chosen to pay for it. The reporting has been cited by <em>Bloomberg</em>, <em>SportBusiness</em>, <em>ESPNcricinfo</em>, <em>The Athletic</em> and <em>SportsPro</em>.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            The desks that read it work in consulting, law, agencies, broadcast, funds and franchises. They use it to brief a colleague before a client meeting, find the deal context behind an announcement, check what was reported about a franchise, a rights cycle or an owner, and give analysts and associates the same starting point. When the meeting starts, everyone in the room has the same facts. That's the whole product.
          </p>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            A team plan puts the weekly story, the twice-weekly Left Field briefings and the full searchable archive in front of everyone on the desk who needs it. Each person gets their own sign-in. One administrator adds or removes people as the team changes. Nothing to re-sign, nothing lost when someone leaves.
          </p>
          <div data-testid="teams-pricing" className="space-y-8">
            {PLANS.map((p) => (
              <div key={p.id}>
                <p className="font-editorial font-medium text-lg mb-1">{p.name}</p>
                <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)] mb-3">
                  {p.body}
                </p>
                {paidPlan === p.id ? (
                  <p className="font-plex text-sm text-[var(--text-muted)] border-b border-[var(--rule)] py-3 max-w-[480px]">
                    Paid. Check your email — your team dashboard link is on its way.
                  </p>
                ) : openPlan === p.id ? (
                  <div className="max-w-[480px]">
                    <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Company name</p>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Sports Consulting"
                      data-testid={`teams-company-name-${p.id}`}
                      className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 mb-5 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)]"
                    />
                    {companyName.trim() && (
                      <RazorpayCheckoutButton
                        plan={p.id}
                        country="IN"
                        buttonLabel={`Pay for ${p.name}`}
                        dataTestId={`teams-checkout-${p.id}`}
                        extraVerifyFields={{ company_name: companyName.trim() }}
                        disclosureText="One annual, GST-compliant invoice. Your team dashboard link — where you add seats yourself — arrives by email right after payment."
                        onSuccess={() => setPaidPlan(p.id)}
                      />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setOpenPlan(p.id); setCompanyName(''); }}
                    data-testid={`teams-cta-${p.id}`}
                    className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                  >
                    Buy {p.name}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
            More than ten seats, or want to talk it through first? Write to me:{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors">
              venkat@stateofplay.club
            </a>. Already subscribed?{' '}
            <Link to="/teams/login" className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors" data-testid="teams-existing-customer-link">
              Go to your team account
            </Link>.
          </p>
        </div>
        <p className="font-editorial italic text-lg mt-10">Venkat</p>
      </section>
    </MockupLayout>
  );
};

export default TeamsMockup;
