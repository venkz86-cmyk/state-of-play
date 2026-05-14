import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useGeoPricing } from '../hooks/useGeoPricing';
import {
  ArrowUpRight,
  Plus,
  Minus,
} from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const BENEFITS = [
  ['01', 'Weekly TSOP Story', 'Deep reportage and long-form analysis on the Indian sports business ecosystem — leagues, franchises, media rights, sponsorship.'],
  ['02', 'Bi-weekly Left Field', 'Curated news briefs covering Indian and global sports business.'],
  ['03', 'Full Archive Access', 'Every premium story since launch — searchable and always available.'],
  ['04', 'Breaking News Alerts', 'First to know about major deals and announcements.'],
  ['05', 'Exclusive Interviews', 'TSOP Transcript Q&As with industry insiders.'],
  ['06', 'Data & Analysis', 'IRR models, valuation breakdowns, market sizing.'],
  ['07', 'Ad-Free Experience', 'No sponsored content, no ads — just journalism.'],
  ['08', 'Direct Access', 'Reply to any newsletter, get responses from Venkat.'],
];

const PERSONAS = [
  ['Sports Franchises & Leagues', 'Track competitor deals, benchmark valuations, inform commercial and M&A strategy.'],
  ['Agencies & Brands', 'Brief clients on market trends, identify sponsorship and partnership opportunities.'],
  ['Investors & Advisors', 'Deal flow intelligence, sector analysis, investment thesis development across Indian sport.'],
];

const FAQS = [
  {
    q: 'What sports do you cover?',
    a: 'The full business of Indian sport: cricket (IPL, domestic, international rights), football (ISL), kabaddi (PKL), badminton, hockey, motorsport, emerging leagues, private equity deals, media rights, sports tech, governance and regulatory developments.',
  },
  {
    q: 'How is this different from The Left Field?',
    a: 'The Left Field is a free news brief. TSOP is original, reported, long-form analysis — plus exclusive interviews, investigations and data breakdowns.',
  },
  {
    q: 'What happens after I subscribe?',
    a: 'After payment via Razorpay your account is created automatically. Check your email for a verification link, click it, and you’ll have immediate access to all premium content.',
  },
  {
    q: 'How long is the subscription?',
    a: 'Subscriptions are annual (12 months from purchase). You’ll receive a renewal reminder before your subscription expires.',
  },
];

export const SubscribeMockup = () => {
  const pricing = useGeoPricing();
  const [premium, setPremium] = useState([]);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const list = await ghostAPI.getPosts({ limit: 8 });
        setPremium(list.filter((p) => p.is_premium).slice(0, 4));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const scrollToPricing = () =>
    document
      .querySelector('[data-testid="mockup-pricing-card"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <MockupLayout testId="mockup-subscribe">
      {/* Hero */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <Overline className="text-[#234ba0] mb-5 block">— Subscribe —</Overline>
            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4.5rem] leading-[1] mb-6">
              India’s premier{' '}
              <em className="italic font-normal text-[#234ba0]">sports business intelligence.</em>
            </h1>
            <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] max-w-[60ch] leading-relaxed">
              Deep-dive analysis, exclusive interviews and the untold stories behind the business of Indian sport — across leagues, franchises, governance, media rights, retail and policy. Delivered weekly.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col lg:items-end gap-5">
            <button
              type="button"
              onClick={scrollToPricing}
              data-testid="hero-pricing-cta"
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              See pricing
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <span className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#475569]">
              Annual · cancel anytime
            </span>
          </div>
        </div>
      </section>

      {/* Cited by — pure typography strip */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 text-center">
          <Overline className="block mb-4">Cited By</Overline>
          <p className="font-editorial italic text-xl md:text-2xl leading-snug text-[#0F172A] dark:text-[#F8FAFC]">
            Bloomberg &nbsp;·&nbsp; SportBusiness &nbsp;·&nbsp; ESPNCricinfo &nbsp;·&nbsp; The Athletic &nbsp;·&nbsp; SportsPro
          </p>
        </div>
      </section>

      {/* Pricing — sharp, no rounded card chrome */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <Overline className="text-[#234ba0] mb-5 block">— Pricing —</Overline>
              <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3rem] leading-[1.05]">
                One subscription. The whole desk.
              </h2>
              <p className="font-plex text-base text-[#475569] dark:text-[#94A3B8] mt-5 max-w-[40ch] leading-relaxed">
                A flat annual fee gets you everything we publish, plus the archive. Use the same email at checkout that you’ll use to read.
              </p>
            </div>
            <div className="lg:col-span-7">
              <div
                data-testid="mockup-pricing-card"
                className="border-y-2 border-[#0F172A] dark:border-[#F8FAFC] py-12 lg:py-16"
              >
                <Overline className="text-[var(--accent)] mb-6 block">Annual Membership</Overline>
                <div className="flex items-end gap-3 mb-3">
                  <span className="font-editorial font-semibold tracking-tight text-[5rem] lg:text-[7rem] leading-[0.9] text-[#0F172A] dark:text-[#F8FAFC]">
                    {pricing.symbol}{pricing.amount}
                  </span>
                  <span className="font-plex text-lg text-[#475569] dark:text-[#94A3B8] pb-3">/ year</span>
                </div>
                <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mb-10 max-w-[55ch]">
                  {pricing.note || 'Billed annually. 12 months of full access.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    data-testid="pricing-subscribe"
                    className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
                  >
                    Subscribe via Razorpay
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <Link
                    to="/mockup/login"
                    data-testid="pricing-signin"
                    className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200 self-start sm:self-center"
                  >
                    Already a subscriber? Sign in
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                </div>

                <Overline className="block mt-10">Secured by Razorpay · GST-compliant invoice</Overline>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's included — print-column grid */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="flex items-end justify-between mb-12">
            <div>
              <Overline className="text-[#234ba0] mb-3 block">— What’s Included —</Overline>
              <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                Eight reasons to read.
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#E2E8F0] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B]">
            {BENEFITS.map(([no, title, desc]) => (
              <div key={no} className="bg-[#F7F7F5] dark:bg-[#090E17] p-7 lg:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-plex-mono text-[10px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                    {no}
                  </span>
                  <span className="h-px w-6 bg-[#CBD5E1]" />
                </div>
                <h3 className="font-editorial font-semibold text-xl leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-3">
                  {title}
                </h3>
                <p className="font-plex text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent premium analysis */}
      {premium.length > 0 && (
        <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
            <Overline className="text-[#234ba0] mb-3 block">— A Sample of the Desk —</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-12">
              Recent premium analysis.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {premium.map((p) => (
                <Link
                  key={p.id}
                  to={`/mockup/article/${p.id}`}
                  data-testid={`subscribe-premium-${p.id}`}
                  className="group block py-6 border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15"
                >
                  <Overline className="text-[#234ba0] mb-2 block">{p.theme || 'Reportage'}</Overline>
                  <h3 className="font-editorial font-semibold text-2xl lg:text-[1.6rem] leading-[1.18] text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#234ba0] transition-colors duration-200">
                    {p.title}
                  </h3>
                  {p.subtitle && (
                    <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mt-2 line-clamp-2 max-w-[55ch]">
                      {p.subtitle}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Who reads */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <Overline className="text-[#234ba0] mb-3 block">— Who Reads TSOP —</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-12">
            On the desks of decision-makers.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-[#E2E8F0] dark:lg:divide-[#1E293B] border-y border-[#E2E8F0] dark:border-[#1E293B]">
            {PERSONAS.map(([title, desc], i) => (
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
                {FAQS.map((f, i) => (
                  <li key={f.q} className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
                    <button
                      type="button"
                      onClick={() => setOpen(open === i ? -1 : i)}
                      className="w-full py-6 flex items-start justify-between gap-6 text-left hover:text-[#234ba0] transition-colors duration-200"
                      data-testid={`subscribe-faq-${i}`}
                    >
                      <span className="font-editorial font-semibold text-xl lg:text-[1.5rem] leading-snug">
                        {f.q}
                      </span>
                      {open === i ? (
                        <Minus className="h-5 w-5 mt-2 shrink-0" strokeWidth={1.5} />
                      ) : (
                        <Plus className="h-5 w-5 mt-2 shrink-0" strokeWidth={1.5} />
                      )}
                    </button>
                    {open === i && (
                      <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] leading-relaxed pb-7 max-w-[60ch]">
                        {f.a}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32 text-left">
          <Overline className="text-[var(--accent)] mb-5 block">Subscribe</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[4rem] leading-[1.02] max-w-3xl mb-8">
            Ready to upgrade your sports business intelligence?
          </h2>
          <p className="font-plex text-lg leading-relaxed text-white/70 mb-10 max-w-[55ch]">
            Join the analysts at the funds, leagues and agencies actually moving the market.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
            <button
              type="button"
              onClick={scrollToPricing}
              data-testid="final-cta"
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              Subscribe — {pricing.symbol}{pricing.amount}/year
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <a
              href="mailto:venkat@stateofplay.club"
              className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
            >
              Questions? venkat@stateofplay.club
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default SubscribeMockup;
