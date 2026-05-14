import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowUpRight, Mail } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const API = process.env.REACT_APP_BACKEND_URL;

const fmtDate = (iso) =>
  iso
    ? new Date(iso)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        .toUpperCase()
    : '';

// Fallback mock items if Substack feed isn't reachable, so the design is reviewable
const FALLBACK = [
  {
    id: 'lf-1',
    title: 'The IPL’s next media-rights cycle is already being wargamed',
    subtitle: 'Notes from a week of conversations with broadcasters and bankers ahead of the next bid window.',
    author: 'The Left Field',
    created_at: '2026-04-25T09:00:00Z',
    external_url: 'https://theleftfield.substack.com',
  },
  {
    id: 'lf-2',
    title: 'Why ISL clubs are quietly hiring data leads — and what they’re asked to prove',
    subtitle: 'A short read on the new headcount appearing in Indian football front offices.',
    author: 'The Left Field',
    created_at: '2026-04-18T09:00:00Z',
    external_url: 'https://theleftfield.substack.com',
  },
  {
    id: 'lf-3',
    title: 'Inside the franchise sale process: a quick primer for first-time bidders',
    subtitle: 'How financial advisers structure information asymmetry — and why the second offer almost always wins.',
    author: 'The Left Field',
    created_at: '2026-04-11T09:00:00Z',
    external_url: 'https://theleftfield.substack.com',
  },
  {
    id: 'lf-4',
    title: 'Sponsorship math in 2026: the new floor, the new ceiling, the new walkaway',
    subtitle: 'Where Indian brand budgets are landing this year, and the categories quietly walking away from cricket.',
    author: 'The Left Field',
    created_at: '2026-04-04T09:00:00Z',
    external_url: 'https://theleftfield.substack.com',
  },
  {
    id: 'lf-5',
    title: 'A short note on the BCCI’s commercial committee — and what it actually decides',
    subtitle: 'Briefly, on the room where the cricket business gets reshaped each quarter.',
    author: 'The Left Field',
    created_at: '2026-03-28T09:00:00Z',
    external_url: 'https://theleftfield.substack.com',
  },
  {
    id: 'lf-6',
    title: 'PE in Indian sport: three theses, two pitfalls, one open question',
    subtitle: 'A field guide for the funds finally crossing the threshold.',
    author: 'The Left Field',
    created_at: '2026-03-21T09:00:00Z',
    external_url: 'https://theleftfield.substack.com',
  },
];

export const LeftFieldMockup = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (API) {
          const r = await axios.get(`${API}/api/substack/feed`, { timeout: 5000 });
          if (active && Array.isArray(r.data) && r.data.length > 0) {
            setItems(r.data);
            return;
          }
        }
        if (active) setItems(FALLBACK);
      } catch (e) {
        if (active) setItems(FALLBACK);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const lead = items[0];
  const grid = items.slice(1, 5);
  const list = items.slice(5);

  return (
    <MockupLayout testId="mockup-leftfield">
      {/* Hero */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-5">
              <Overline className="text-[#234ba0]">— The Left Field —</Overline>
              <span className="h-px w-8 bg-[#234ba0]/40" />
              <Overline className="text-[var(--accent)]">Free · Bi-weekly</Overline>
            </div>
            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[5rem] leading-[1] mb-6">
              The brief on{' '}
              <em className="italic font-normal text-[#234ba0]">Indian sport, in your inbox.</em>
            </h1>
            <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] max-w-[60ch] leading-relaxed">
              Short, sharp news briefs on the businesses, deals and people moving Indian sport — published bi-weekly on Substack. Free to read. The on-ramp to the full TSOP desk.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col lg:items-end gap-5">
            <a
              href="https://theleftfield.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="leftfield-subscribe"
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              <Mail className="h-4 w-4" strokeWidth={2} />
              Subscribe on Substack
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </a>
            <span className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#475569]">
              No paywall · Unsubscribe any time
            </span>
          </div>
        </div>
      </section>

      {/* Editor's pitch — italic strip */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-3">
            <Overline className="text-[var(--accent)]">— What it is —</Overline>
          </div>
          <div className="lg:col-span-9 max-w-[60ch]">
            <p className="font-editorial italic text-2xl lg:text-[2rem] leading-[1.2] tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              “Six minutes, twice a week. The deals worth knowing about, the small stories that turn into big ones, and the curated pointers we’d send a friend who works in the industry.”
            </p>
            <footer className="mt-8 flex items-center gap-3">
              <span className="h-px w-12 bg-[#0F172A] dark:bg-[#F8FAFC]" />
              <Overline>The Left Field · Editorial</Overline>
            </footer>
          </div>
        </div>
      </section>

      {/* Lead + grid */}
      {loading ? (
        <section className="py-20 text-center">
          <Overline>Loading edition…</Overline>
        </section>
      ) : (
        <>
          {lead && (
            <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
              <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
                <a
                  href={lead.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="leftfield-lead"
                  className="group lg:col-span-7 block"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Overline className="text-[#234ba0]">Latest Brief</Overline>
                    <span className="h-px w-6 bg-[#234ba0]/40" />
                    <Overline>{fmtDate(lead.created_at)}</Overline>
                  </div>
                  <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[3rem] leading-[1.05] mb-5 group-hover:text-[#234ba0] transition-colors duration-200">
                    {lead.title}
                  </h2>
                  {lead.subtitle && (
                    <p className="font-plex text-lg text-[#475569] dark:text-[#94A3B8] max-w-[60ch] leading-relaxed mb-6">
                      {lead.subtitle}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 group-hover:text-[#234ba0] group-hover:border-[#234ba0] transition-colors duration-200">
                    Read on Substack
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                </a>

                <aside className="lg:col-span-5 lg:pl-10 lg:border-l lg:border-[#E2E8F0] dark:lg:border-[#1E293B]">
                  <Overline className="text-[var(--accent)] mb-8 block">— Recent briefs —</Overline>
                  <ul>
                    {grid.map((p, i) => (
                      <li
                        key={p.id}
                        className={i === grid.length - 1 ? '' : 'pb-7 mb-7 border-b border-[#E2E8F0] dark:border-[#1E293B]'}
                      >
                        <a
                          href={p.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                          data-testid={`leftfield-side-${p.id}`}
                        >
                          <Overline className="block mb-2">{fmtDate(p.created_at)}</Overline>
                          <h3 className="font-editorial font-semibold text-xl lg:text-[1.5rem] leading-[1.2] mb-2 group-hover:text-[#234ba0] transition-colors duration-200">
                            {p.title}
                          </h3>
                          {p.subtitle && (
                            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] line-clamp-2 max-w-[40ch]">
                              {p.subtitle}
                            </p>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </section>
          )}

          {/* Index list */}
          {list.length > 0 && (
            <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
              <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
                <div className="flex items-end justify-between mb-12">
                  <div>
                    <Overline className="text-[#234ba0] mb-3 block">— The archive —</Overline>
                    <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                      Earlier briefs.
                    </h2>
                  </div>
                </div>

                <ul className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
                  {list.map((p, i) => (
                    <li key={p.id}>
                      <a
                        href={p.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`leftfield-list-${p.id}`}
                        className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-7 border-b border-[#E2E8F0] dark:border-[#1E293B] hover:bg-[#F1F1EE] dark:hover:bg-[#0F172A] -mx-3 px-3 transition-colors duration-200"
                      >
                        <span className="hidden md:block col-span-1 font-plex-mono text-[11px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="col-span-12 md:col-span-2">
                          <Overline className="text-[#234ba0]">Brief</Overline>
                        </div>
                        <h3 className="col-span-12 md:col-span-7 font-editorial font-semibold text-xl lg:text-[1.5rem] leading-[1.2] group-hover:text-[#234ba0] transition-colors duration-200">
                          {p.title}
                        </h3>
                        <div className="hidden md:flex col-span-2 items-center justify-end gap-3">
                          <Overline>{fmtDate(p.created_at)}</Overline>
                          <ArrowUpRight className="h-4 w-4 text-[#94A3B8] group-hover:text-[#234ba0] transition-colors duration-200" strokeWidth={1.5} />
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      {/* Upgrade ladder — Free → Paid */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <Overline className="text-[var(--accent)] mb-5 block">— Want the full desk? —</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3.5rem] leading-[1.05] mb-5">
              The Left Field is free. <em className="italic font-normal text-white/60">The State of Play is the rest.</em>
            </h2>
            <p className="font-plex text-lg leading-relaxed text-white/70 max-w-[55ch]">
              If the briefs are useful, the long-form reportage is where the real intelligence sits. Weekly TSOP deep-dives, full archive, and breaking news alerts.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col gap-4 lg:items-end">
            <a
              href="/mockup/subscribe"
              data-testid="leftfield-upgrade"
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              Upgrade to TSOP
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </a>
            <a
              href="https://theleftfield.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
            >
              Stay free on Substack
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default LeftFieldMockup;
