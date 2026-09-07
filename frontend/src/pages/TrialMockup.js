import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const TRACK = [
  ['Day 1', 'You pay, you read', 'The ten most recent premium stories the moment you sign up. In full. Permanently yours.'],
  ['Week 2', 'A new story every week', 'I publish one long-form story every week. Anything that comes out while you are in, you can read too.'],
  ['Weeks 3–4', 'Same again', 'By the end of the month, most readers of The Ten have read fourteen stories, not ten. Nothing lost, only added.'],
  ['Day 30', 'The extras close', 'Anything published after you joined closes with the month. Your original ten never do.'],
];

const FAQS = [
  ['What happens to my ten stories after 30 days?', 'They stay yours, permanently. That never changes, whether you subscribe or not. If you don’t subscribe, your account becomes a free membership, same as anyone who signs up for the Left Field briefing, with the original ten still there whenever you want them. What closes is everything published after you joined. Subscribing picks that back up, plus the rest of the archive.'],
  ['Can I upgrade before the 30 days are up?', 'Yes, any time. Take the annual membership before your month ends and you get thirteen months for the price of twelve. You pay the annual rate on the day you upgrade: ₹2,499 + GST until 30 September, ₹3,499 + GST from 1 October.'],
  ['Does it auto-renew into a subscription?', 'No. It is a one-time payment for thirty days. Nothing renews, nothing charges you again. If you want more after that, you choose it yourself.'],
  ['What am I not getting, compared to a subscription?', 'The full archive, comments, nominating other readers, and anything published after your thirty days. The original ten stories are the same either way.'],
];

export const TrialMockup = () => {
  const pricing = useGeoPricing();
  const isIndia = pricing.country === 'IN';

  return (
    <MockupLayout testId="mockup-trial" seo={{ title: 'The Ten', path: '/trial', description: 'Ten of The State of Play’s most recent stories on the business of Indian sport, for ₹590. Stay the month and everything new is yours too.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru · {datelineDate()}</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">The Trial · The Ten</span>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-16 pb-12">
        <Overline className="mb-4 block">— The State of Play —</Overline>
        <h1 className="font-editorial font-semibold tracking-tight text-[2.4rem] md:text-[3.5rem] leading-[1.05] mb-6 max-w-[16ch]">
          Ten stories.<br />Thirty days.<br /><em className="italic font-normal">₹500.</em>
        </h1>
        <p className="font-plex text-lg text-[var(--text-muted)] leading-relaxed max-w-[54ch] mb-8">
          Read the ten most recent State of Play stories on the business of Indian sport: franchise valuations, broadcast rights, ownership fights, the deals nobody else is reporting properly. They are yours to keep. And while your month runs, everything new I publish is yours to read too.
        </p>

        {isIndia ? (
          <>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="font-editorial font-semibold text-[2.75rem] leading-[0.9] text-[var(--text)]">₹500</span>
              <span className="font-plex text-[15px] text-[var(--text-muted)]">+ 18% GST · ₹590 total · one payment, not a subscription</span>
            </div>
            <RazorpayCheckoutButton
              plan="trial"
              country="IN"
              buttonLabel="Start The Ten"
              dataTestId="trial-checkout"
              className="max-w-[520px] mb-4"
            />
            <a href="#compare" className="font-plex text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] transition-colors">
              Compare with the annual membership
            </a>
          </>
        ) : (
          <p className="font-plex text-base text-[var(--text-muted)] max-w-[50ch]">
            The Ten is available in India only right now.{' '}
            <a href="/signup" className="text-[var(--accent-burgundy)] underline underline-offset-4">The annual membership</a> is open everywhere.
          </p>
        )}
      </section>

      {/* How the month works */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-3">How the month works</p>
          <p className="font-plex text-base text-[var(--text-muted)] max-w-[60ch] mb-10">
            The ten stories are yours to keep, whatever you decide later. What you read beyond the ten is yours for the month.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-8">
            {TRACK.map(([day, title, desc], i) => (
              <div key={day} className="border-l-2 pl-4" style={{ borderColor: i === 0 ? 'var(--accent-burgundy)' : 'var(--rule)' }}>
                <p className="font-plex text-xs tracking-[0.1em] uppercase text-[var(--text-label)] tabular-nums mb-2">{day}</p>
                <h3 className="font-editorial font-medium text-lg leading-snug mb-1.5">{title}</h3>
                <p className="font-plex text-[13.5px] leading-relaxed text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* If it's for you */}
      <section id="compare" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12 scroll-mt-24">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">If it's for you</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <p className="font-editorial font-medium text-lg mb-1">The Ten</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-editorial font-semibold text-[2.25rem] leading-[0.9]">₹590</span>
              </div>
              <p className="font-plex text-[13px] text-[var(--text-label)] mb-4">once · yours to keep · no renewal</p>
              <ul className="space-y-2.5">
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">Ten stories on day one, growing through the month</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">The original ten, permanently, even if you never subscribe</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['−'] before:absolute before:left-0 before:text-[var(--text-label)]">The extras close with the month</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['−'] before:absolute before:left-0 before:text-[var(--text-label)]">No comments, no nominating other readers</li>
              </ul>
            </div>
            <div>
              <p className="font-editorial font-medium text-lg mb-1">Annual membership</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-editorial font-semibold text-[2.25rem] leading-[0.9]">₹2,499</span>
                <span className="font-plex text-sm text-[var(--text-muted)]">+ GST</span>
              </div>
              <p className="font-plex text-[13px] text-[var(--text-label)] mb-4">until 30 September · ₹3,499 + GST from 1 October</p>
              <ul className="space-y-2.5">
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">Everything, every week, all year</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">Full archive, searchable</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">Comments and nominating other readers</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">Direct line to the desk</li>
                <li className="font-plex text-sm text-[var(--text-muted)] pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-[var(--accent-burgundy)]">Upgrade from The Ten and get thirteen months for the price of twelve</li>
              </ul>
            </div>
          </div>
          <p className="font-plex text-sm text-[var(--text-muted)] mt-8">
            The Left Field briefing is free either way: trial, subscriber, or neither.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">Before you start</p>
          <ul>
            {FAQS.map(([q, a]) => (
              <li key={q} className="py-6 border-b border-[var(--rule)]">
                <p className="font-editorial font-medium text-lg leading-snug mb-2">{q}</p>
                <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed max-w-[65ch]">{a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Close */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-xl mb-4">Ten stories. Thirty days. See if it is for you.</p>
          <p className="font-plex text-base text-[var(--text-muted)] max-w-[55ch] mb-6">
            And if it is not for you, no hard feelings. You keep the ten, and The Left Field keeps coming, free, every Monday and Wednesday.
          </p>
          <p className="font-editorial italic text-lg">Venkat</p>
        </div>
      </section>
    </MockupLayout>
  );
};

export default TrialMockup;
