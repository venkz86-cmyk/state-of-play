import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayButton } from '../components/RazorpayButton';
import { TESTIMONIALS } from '../data/testimonials';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

// A short, specific pull-quote for the hero rail -- real and attributable,
// unlike a logo-strip of outlet names TSOP hasn't actually been covered
// by. Picked for length (fits a sidebar without truncation), not order.
const heroTestimonial = TESTIMONIALS.find((t) => t.name === 'Joy Bhattacharjya') || TESTIMONIALS[0];

const BENEFITS = [
  ['The weekly story', 'Deep reportage and long-form analysis on Indian sports business.'],
  ['The Left Field briefing', 'News briefs covering Indian and global sports business, twice a week.'],
  ['The full archive', 'Every premium story since launch, searchable and always available.'],
  ['First on the big deals', 'The desk reports major transactions and announcements before anyone else covers them properly.'],
  ['The TSOP Transcript', 'Q&As with the people actually running the business of Indian sport.'],
  ['The numbers behind the story', 'IRR models, valuation breakdowns, market sizing.'],
  ['No advertising', 'No sponsored content, no ads. Just journalism.'],
  ['A direct line to the desk', 'Reply to any newsletter, get a response from Venkat.'],
];

const FAQS = [
  ['What sports do you cover?', 'The full business of Indian sport: cricket, football, kabaddi, badminton, hockey, motorsport, emerging leagues, private equity deals, media rights, sports tech, governance and regulatory developments.'],
  ['How is this different from The Left Field?', 'The Left Field is a free news brief. TSOP is original, reported, long-form analysis, plus exclusive interviews, investigations and data breakdowns.'],
  ['What happens after I subscribe?', 'Your account is created automatically after payment via Razorpay. Check your email for a verification link and you’ll have immediate access.'],
  ['How long is the subscription?', 'Annual. 12 months from purchase. You’ll receive a renewal reminder before it expires.'],
];

export const SubscribeMockup = () => {
  const pricing = useGeoPricing();
  const [premium, setPremium] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await ghostAPI.getPosts({ limit: 8 });
        setPremium(list.filter((p) => p.is_premium).slice(0, 4));
      } catch (e) { console.error(e); }
    })();
  }, []);

  return (
    <MockupLayout testId="mockup-subscribe" seo={{ title: 'Subscribe', path: '/signup', description: 'Subscribe to The State of Play, India\'s sports business publication. Premium reportage, member benefits, and a private subscriber community.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">
            Subscribe
          </span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem] leading-[1.05] mb-6 max-w-[22ch]">
            The desk that tracks <em className="italic font-normal">where the money in Indian sport actually goes.</em>
          </h1>
          <p className="font-plex text-lg lg:text-xl text-[var(--text-muted)] leading-relaxed max-w-[55ch]">
            Original reporting on the business of Indian sport: the deals, the valuations and the people making them. Delivered weekly.
          </p>
        </div>
        <aside className="lg:col-span-4 lg:border-l lg:border-[var(--rule)]/15 lg:pl-10">
          <Overline className="!normal-case !tracking-normal !text-sm block mb-3">What readers say</Overline>
          <p className="font-editorial italic text-base lg:text-lg leading-snug text-[var(--text)] mb-3">
            “{heroTestimonial.quote[0]}”
          </p>
          <p className="font-plex text-[13px] font-bold text-[var(--text)]">
            {heroTestimonial.name}
          </p>
          {heroTestimonial.title && (
            <p className="font-plex text-[13px] text-[var(--text-label)]">{heroTestimonial.title}</p>
          )}
        </aside>
      </section>

      {/* Pricing */}
      <section data-testid="mockup-pricing-card" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--rule)] pt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <p className="font-editorial italic text-lg text-[var(--text)] mb-3">Annual Membership</p>
            <div className="flex items-end gap-3 mb-2">
              <span className="font-editorial font-semibold tracking-tight text-[3.5rem] lg:text-[5rem] leading-[0.9] text-[var(--text)]">
                {pricing.country === 'IN' ? '₹2,499' : '$120'}
              </span>
              <span className="font-plex text-base text-[var(--text-muted)] pb-3">
                {pricing.country === 'IN' ? '+ 18% GST / year' : '/ year'}
              </span>
            </div>
            {pricing.country === 'IN' && (
              <p className="font-plex text-[14px] text-[var(--text-label)] mb-3">₹2,949 / year total</p>
            )}
            <p className="font-plex text-sm text-[var(--text-muted)] max-w-[55ch]">
              One payment for the year.{pricing.country === 'IN' ? ' GST-compliant invoice included.' : ''}
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col gap-3 lg:items-end">
            <RazorpayButton dataTestId="pricing-subscribe" />
            <Link
              to="/login"
              className="font-plex text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] transition-colors"
            >
              Already a subscriber? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">What you get</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16">
            {BENEFITS.map(([title, desc], i) => (
              <div
                key={title}
                className={`py-5 ${i < BENEFITS.length - 2 ? 'border-b border-[var(--rule)]' : ''} ${i % 2 === 0 ? 'md:pr-8' : 'md:pl-8'}`}
              >
                <h3 className="font-editorial font-medium text-lg leading-snug text-[var(--text)] mb-2">{title}</h3>
                <p className="font-plex text-sm leading-relaxed text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample of the desk */}
      {premium.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
          <div className="border-t border-[var(--text)] pt-8">
            <p className="font-editorial italic text-lg mb-6">A sample of the desk</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
              {premium.map((p) => (
                <Link
                  key={p.id}
                  to={`/${p.id}`}
                  className="group block py-5 border-b border-[var(--rule)]"
                >
                  <p className="font-plex text-xs tracking-[0.18em] uppercase text-[var(--text-muted)] mb-2">{p.theme}</p>
                  <h3 className="font-editorial font-medium text-lg leading-snug text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-200">{p.title}</h3>
                  <p className="font-plex text-xs text-[var(--text-muted)] mt-2 tabular-nums">{longDate(p.created_at)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="font-editorial italic text-lg">FAQ</p>
          </div>
          <div className="lg:col-span-8">
            <ul>
              {FAQS.map(([q, a]) => (
                <li key={q} className="py-6 border-b border-[var(--rule)]">
                  <p className="font-editorial font-medium text-lg lg:text-xl leading-snug mb-2">{q}</p>
                  <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed max-w-[60ch]">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default SubscribeMockup;
