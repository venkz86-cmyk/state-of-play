import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';

// Long-form date — "Sunday, 04 June 2026"
const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// Short date — "04 June 2026"
const shortDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const HomeMockup = () => {
  const [articles, setArticles] = useState([]);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { canAccessPremium } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;

  // Typography system toggle (kept for review only)
  const SYSTEMS = {
    newsreader: { display: 'Newsreader', body: 'Newsreader', tracking: '0.16em', label: 'Newsreader' },
    'fraunces-geist': { display: 'Fraunces', body: 'Geist', tracking: '0.14em', label: 'Fraunces × Geist' },
    spectral: { display: 'Spectral', body: 'Spectral', tracking: '0.16em', label: 'Spectral' },
  };
  const systemKey = SYSTEMS[searchParams.get('system')] ? searchParams.get('system') : 'newsreader';
  const system = SYSTEMS[systemKey];
  const setSystem = (k) => {
    const next = new URLSearchParams(searchParams);
    if (k && k !== 'newsreader') next.set('system', k);
    else next.delete('system');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    (async () => {
      try {
        const posts = await ghostAPI.getPosts({ limit: 12 });
        if (posts.length > 0) {
          setLead(posts[0]);
          setArticles(posts.slice(1));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <span className="text-sm text-[#475569]">Loading…</span>
      </div>
    );
  }

  // Issue number — simple incrementing reference, content-of-record signal
  const issueNo = 47;

  return (
    <div
      className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] text-[#0F172A] dark:text-[#F8FAFC]"
      style={{
        '--display-font': `'${system.display}'`,
        '--body-font': `'${system.body}'`,
        '--label-font': `'${system.body}'`,
        '--label-tracking': system.tracking,
      }}
      data-testid="mockup-home"
    >
      <MockupHeader />

      {/* System picker — review only */}
      <div
        data-testid="system-toggle"
        className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white border border-white/10 shadow-2xl"
      >
        <div className="flex flex-col">
          {Object.entries(SYSTEMS).map(([key, s]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSystem(key)}
              data-testid={`system-${key}`}
              className={`text-left px-5 py-3 transition-colors duration-200 border-b border-white/5 last:border-b-0 ${
                systemKey === key ? 'bg-white text-[#0F172A]' : 'hover:bg-white/5 text-white'
              }`}
              style={{ fontFamily: `'${s.display}', serif` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* DATELINE STRIP — quiet anchor like a masthead */}
      <div className="max-w-[1100px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16">
        <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
          <span className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] tracking-tight">
            Bengaluru · {datelineDate()}
          </span>
          <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">
            No.&nbsp;{issueNo}
          </span>
        </div>
      </div>

      {/* LEAD STORY */}
      {lead && (
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pt-12 lg:pt-14 pb-20 lg:pb-24">
          <Link to={`/${lead.id}`} data-testid="lead-link" className="group block">
            <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem] leading-[1.05] mb-5 max-w-[22ch] group-hover:text-[var(--accent)] transition-colors duration-300">
              {lead.title}
            </h1>
            {lead.subtitle && (
              <p className="font-plex text-lg lg:text-xl leading-[1.45] text-[#334155] dark:text-[#CBD5E1] max-w-[58ch] mb-7">
                {lead.subtitle}
              </p>
            )}
            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
              By {lead.author || 'The State of Play'}
              {lead.theme ? <span className="text-[#94A3B8]"> · {lead.theme}</span> : null}
              {lead.read_time ? <span className="text-[#94A3B8]"> · {lead.read_time} min read</span> : null}
            </p>
          </Link>

          {lead.image_url && (
            <div className="mt-12 lg:mt-14 overflow-hidden">
              <img
                src={lead.image_url}
                alt={lead.title}
                referrerPolicy="no-referrer"
                className="w-full aspect-[16/9] object-cover saturate-0 hover:saturate-100 transition-all duration-700 ease-out"
              />
            </div>
          )}
        </section>
      )}

      {/* RECENT — quiet list, smaller titles, two-column hint on desktop */}
      {articles.length > 0 && (
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pb-24 lg:pb-32">
          <div className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
            {articles.map((a) => (
              <Link
                key={a.id}
                to={`/${a.id}`}
                data-testid={`row-${a.id}`}
                className="group grid grid-cols-1 md:grid-cols-12 gap-x-10 gap-y-2 py-8 lg:py-9 border-b border-[#E2E8F0] dark:border-[#1E293B]"
              >
                <h2 className="md:col-span-7 font-editorial font-medium tracking-tight text-xl lg:text-[1.625rem] leading-[1.2] text-[#0F172A] dark:text-[#F8FAFC] max-w-[34ch] group-hover:text-[var(--accent)] transition-colors duration-300">
                  {a.title}
                </h2>
                {a.subtitle && (
                  <p className="md:col-span-4 font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] max-w-[40ch] line-clamp-2">
                    {a.subtitle}
                  </p>
                )}
                <p className="md:col-span-1 font-plex text-sm text-[#475569] dark:text-[#94A3B8] md:text-right tabular-nums">
                  {shortDate(a.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* QUIET SUBSCRIBE */}
      {!isMember && (
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pb-32 lg:pb-40">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 max-w-[55ch]">
            <p className="font-editorial italic text-xl lg:text-[1.5rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-5">
              The State of Play is a reader-supported publication.
            </p>
            <p className="font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-6">
              Independent reporting on the business of Indian sport. ₹2,495 a year.
            </p>
            <Link
              to="/signup"
              data-testid="subscribe-link"
              className="font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
            >
              Subscribe →
            </Link>
          </div>
        </section>
      )}

      <MockupFooter />
    </div>
  );
};

export default HomeMockup;
