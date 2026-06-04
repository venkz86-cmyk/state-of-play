import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
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

      {/* LEAD STORY — the headline IS the hero. No section eyebrow, no marketing pitch. */}
      {lead && (
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pt-20 lg:pt-28 pb-24">
          {/* Quiet dateline */}
          <div className="mb-12 lg:mb-16">
            <span className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
              {fmtDate(new Date().toISOString())}
            </span>
          </div>

          <Link to={`/${lead.id}`} data-testid="lead-link" className="group block">
            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4.5rem] leading-[1.02] mb-6 group-hover:text-[var(--accent)] transition-colors duration-300">
              {lead.title}
            </h1>
            {lead.subtitle && (
              <p className="font-plex text-xl lg:text-2xl leading-[1.4] text-[#334155] dark:text-[#CBD5E1] max-w-[60ch] mb-8">
                {lead.subtitle}
              </p>
            )}
            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
              By {lead.author || 'The State of Play'}
              {lead.read_time ? ` · ${lead.read_time} min read` : ''}
            </p>
          </Link>

          {lead.image_url && (
            <div className="mt-14 lg:mt-16">
              <img
                src={lead.image_url}
                alt={lead.title}
                referrerPolicy="no-referrer"
                className="w-full aspect-[16/9] object-cover"
              />
            </div>
          )}
        </section>
      )}

      {/* RECENT — single column list, no card chrome, no overlines */}
      {articles.length > 0 && (
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pb-24 lg:pb-32">
          <div className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
            {articles.map((a) => (
              <Link
                key={a.id}
                to={`/${a.id}`}
                data-testid={`row-${a.id}`}
                className="group block py-10 lg:py-12 border-b border-[#E2E8F0] dark:border-[#1E293B]"
              >
                <h2 className="font-editorial font-medium tracking-tight text-2xl lg:text-[2rem] leading-[1.18] text-[#0F172A] dark:text-[#F8FAFC] mb-3 max-w-[42ch] group-hover:text-[var(--accent)] transition-colors duration-300">
                  {a.title}
                </h2>
                {a.subtitle && (
                  <p className="font-plex text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] max-w-[60ch] mb-4">
                    {a.subtitle}
                  </p>
                )}
                <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
                  {a.author || 'The State of Play'} · {fmtDate(a.created_at)}
                  {a.read_time ? ` · ${a.read_time} min` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* QUIET SUBSCRIBE — one line, one link. Only for non-members. */}
      {!isMember && (
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pb-32 lg:pb-40">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-10 max-w-[60ch]">
            <p className="font-editorial italic text-2xl lg:text-[1.75rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-6">
              The State of Play is a reader-supported publication.
            </p>
            <p className="font-plex text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-8">
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
