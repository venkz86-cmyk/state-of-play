import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { Plus, Minus } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayButton } from '../components/RazorpayButton';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

const BENEFITS = [
  ['01', 'Weekly TSOP Story', 'Deep reportage and long-form analysis on the Indian sports business ecosystem.'],
  ['02', 'Bi-weekly Left Field', 'Curated news briefs covering Indian and global sports business.'],
  ['03', 'Full Archive Access', 'Every premium story since launch — searchable and always available.'],
  ['04', 'Breaking News Alerts', 'First to know about major deals and announcements.'],
  ['05', 'Exclusive Interviews', 'TSOP Transcript Q&As with industry insiders.'],
  ['06', 'Data & Analysis', 'IRR models, valuation breakdowns, market sizing.'],
  ['07', 'Ad-Free Experience', 'No sponsored content, no ads — just journalism.'],
  ['08', 'Direct Access', 'Reply to any newsletter, get responses from Venkat.'],
];

const FAQS = [
  ['What sports do you cover?', 'The full business of Indian sport: cricket, football, kabaddi, badminton, hockey, motorsport, emerging leagues, private equity deals, media rights, sports tech, governance and regulatory developments.'],
  ['How is this different from The Left Field?', 'The Left Field is a free news brief. TSOP is original, reported, long-form analysis — plus exclusive interviews, investigations and data breakdowns.'],
  ['What happens after I subscribe?', 'Your account is created automatically after payment via Razorpay. Check your email for a verification link and you’ll have immediate access.'],
  ['How long is the subscription?', 'Annual — 12 months from purchase. You’ll receive a renewal reminder before it expires.'],
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
      } catch (e) { console.error(e); }
    })();
  }, []);

  return (
    <MockupLayout testId="mockup-subscribe">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru</Overline>
          <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">
            Subscribe
          </span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem] leading-[1.05] mb-6 max-w-[22ch]">
            India’s premier <em className="italic font-normal">sports business intelligence.</em>
          </h1>
          <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] leading-relaxed max-w-[55ch]">
            Deep-dive analysis, exclusive interviews, and the untold stories behind the business of Indian sport — across leagues, franchises, governance, media rights, retail and policy. Delivered weekly.
          </p>
        </div>
        <aside className="lg:col-span-4 lg:border-l lg:border-[#0F172A]/15 dark:lg:border-[#F8FAFC]/15 lg:pl-10">
          <Overline className="!normal-case !tracking-normal !text-sm block mb-3">Cited by</Overline>
          <p className="font-editorial italic text-base lg:text-lg leading-snug text-[#0F172A] dark:text-[#F8FAFC]">
            Bloomberg · SportBusiness · ESPNCricinfo · The Athletic · SportsPro
          </p>
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
              Billed annually. 12 months of full access. GST-compliant invoice.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col gap-3 lg:items-end">
            <RazorpayButton dataTestId="pricing-subscribe" />
            <Link
              to="/mockup/login"
              className="font-plex text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] transition-colors"
            >
              Already a subscriber? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
          <p className="font-editorial italic text-lg mb-8">What’s included</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8">
            {BENEFITS.map(([no, title, desc]) => (
              <div key={no}>
                <p className="font-plex text-xs tracking-[0.18em] uppercase text-[#94A3B8] tabular-nums mb-3">{no}</p>
                <h3 className="font-editorial font-medium text-lg leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-2">{title}</h3>
                <p className="font-plex text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample of the desk */}
      {premium.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
            <p className="font-editorial italic text-lg mb-6">A sample of the desk</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
              {premium.map((p) => (
                <Link
                  key={p.id}
                  to={`/mockup/article/${p.id}`}
                  className="group block py-5 border-b border-[#E2E8F0] dark:border-[#1E293B]"
                >
                  <p className="font-plex text-xs tracking-[0.18em] uppercase text-[#475569] dark:text-[#94A3B8] mb-2">{p.theme || 'Reportage'}</p>
                  <h3 className="font-editorial font-medium text-lg leading-snug text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[var(--accent)] transition-colors duration-200">{p.title}</h3>
                  <p className="font-plex text-xs text-[#475569] dark:text-[#94A3B8] mt-2 tabular-nums">{longDate(p.created_at)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="font-editorial italic text-lg">FAQ</p>
          </div>
          <div className="lg:col-span-8">
            <ul>
              {FAQS.map(([q, a], i) => (
                <li key={q} className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setOpen(open === i ? -1 : i)}
                    className="w-full py-5 flex items-start justify-between gap-6 text-left hover:text-[var(--accent)] transition-colors duration-200"
                  >
                    <span className="font-editorial font-medium text-lg lg:text-xl leading-snug">{q}</span>
                    {open === i ? <Minus className="h-4 w-4 mt-2 shrink-0" strokeWidth={1.5} /> : <Plus className="h-4 w-4 mt-2 shrink-0" strokeWidth={1.5} />}
                  </button>
                  {open === i && (
                    <p className="font-plex text-base text-[#475569] dark:text-[#94A3B8] leading-relaxed pb-6 max-w-[60ch]">{a}</p>
                  )}
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
