import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getReadingHistory } from '../components/ReadingHistory';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';

// Format a Ghost date as e.g. "12 MAR 2026"
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
};

const Overline = ({ children, className = '' }) => (
  <span
    className={`font-plex tabular-nums text-[10px] md:text-[11px] font-medium tracking-[0.22em] uppercase text-[#475569] ${className}`}
  >
    {children}
  </span>
);

const Meta = ({ article, withTheme = true }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    {withTheme && article.theme && (
      <Overline className="text-[#234ba0]">{article.theme}</Overline>
    )}
    {withTheme && article.theme && <span className="text-[#CBD5E1]">·</span>}
    <Overline>{fmtDate(article.created_at)}</Overline>
    <span className="text-[#CBD5E1]">·</span>
    <Overline>{article.read_time} MIN READ</Overline>
  </div>
);

// Hero: spans 8 of 12 cols. Image dominant, title in serif, mono overline.
const HeroArticle = ({ article }) => (
  <Link
    to={`/${article.id}`}
    data-testid="mockup-hero-article"
    className="group block lg:col-span-8 border-r-0 lg:border-r border-[#E2E8F0]"
  >
    <div className="lg:pr-12 xl:pr-16">
      {article.image_url && (
        <div className="relative w-full aspect-[16/10] overflow-hidden bg-[#F1F1EE] mb-8">
          <img
            src={article.image_url}
            alt={article.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover saturate-[0.85] group-hover:saturate-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
          />
          {article.is_premium && (
            <div className="absolute top-5 left-5 bg-[#0F172A] text-white px-3 py-1.5">
              <span className="font-plex tabular-nums text-[10px] font-medium tracking-[0.22em] uppercase">
                Subscribers Only
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-5">
        {article.theme && (
          <Overline className="text-[#234ba0]">{article.theme}</Overline>
        )}
        <span className="h-px w-8 bg-[#234ba0]/40" />
        <Overline>The Big Story</Overline>
      </div>

      <h2 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[3.75rem] leading-[1.04] text-[#0F172A] dark:text-[#F8FAFC] mb-6 transition-colors duration-200 group-hover:text-[#234ba0]">
        {article.title}
      </h2>

      {article.subtitle && (
        <p className="font-plex text-lg lg:text-xl leading-relaxed text-[#334155] dark:text-[#94A3B8] max-w-[60ch] mb-8">
          {article.subtitle}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-6 border-t border-[#E2E8F0]">
        <span className="font-plex text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
          By {article.author || 'TSOP Editorial'}
        </span>
        <span className="text-[#CBD5E1]">·</span>
        <Overline>{fmtDate(article.created_at)}</Overline>
        <span className="text-[#CBD5E1]">·</span>
        <Overline>{article.read_time} MIN READ</Overline>
      </div>
    </div>
  </Link>
);

// Side rail: 2 stacked secondary articles, sharing 4 cols.
const SideArticle = ({ article, isLast = false }) => (
  <Link
    to={`/${article.id}`}
    data-testid={`mockup-side-${article.id}`}
    className={`group block ${isLast ? '' : 'pb-10 mb-10 border-b border-[#E2E8F0]'}`}
  >
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-3 sm:col-span-1 lg:col-span-3 xl:col-span-1">
        {article.image_url && (
          <div className="aspect-[4/3] overflow-hidden bg-[#F1F1EE]">
            <img
              src={article.image_url}
              alt={article.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover saturate-[0.85] group-hover:saturate-100 group-hover:scale-[1.03] transition-all duration-700 ease-out"
            />
          </div>
        )}
      </div>
      <div className="col-span-3 sm:col-span-2 lg:col-span-3 xl:col-span-2">
        <div className="mb-3">
          {article.theme ? (
            <Overline className="text-[#234ba0]">{article.theme}</Overline>
          ) : (
            <Overline>Analysis</Overline>
          )}
        </div>
        <h3 className="font-editorial font-semibold tracking-tight text-xl lg:text-[1.5rem] leading-[1.2] text-[#0F172A] dark:text-[#F8FAFC] mb-3 group-hover:text-[#234ba0] transition-colors duration-200">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px]">
          <Overline>{fmtDate(article.created_at)}</Overline>
          <span className="text-[#CBD5E1]">·</span>
          <Overline>{article.read_time} MIN</Overline>
        </div>
      </div>
    </div>
  </Link>
);

// Lower grid card: print-column style, no card chrome, 1px borders only.
const ColumnCard = ({ article, idx }) => (
  <Link
    to={`/${article.id}`}
    data-testid={`mockup-column-${article.id}`}
    className="group block py-10 px-0 lg:px-8 border-t border-[#E2E8F0] lg:border-t-0 lg:border-l first:lg:border-l-0"
  >
    <div className="flex items-center gap-3 mb-4">
      <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
        {String(idx + 1).padStart(2, '0')}
      </span>
      {article.theme && (
        <>
          <span className="h-px w-4 bg-[#CBD5E1]" />
          <Overline className="text-[#234ba0]">{article.theme}</Overline>
        </>
      )}
    </div>

    {article.image_url && (
      <div className="aspect-[3/2] overflow-hidden bg-[#F1F1EE] mb-5">
        <img
          src={article.image_url}
          alt={article.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover saturate-[0.85] group-hover:saturate-100 group-hover:scale-[1.04] transition-all duration-700 ease-out"
        />
      </div>
    )}

    <h3 className="font-editorial font-semibold tracking-tight text-2xl leading-[1.18] text-[#0F172A] dark:text-[#F8FAFC] mb-3 group-hover:text-[#234ba0] transition-colors duration-200">
      {article.title}
    </h3>

    {article.subtitle && (
      <p className="font-plex text-[15px] leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-5 line-clamp-3">
        {article.subtitle}
      </p>
    )}

    <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0]">
      <span className="font-plex text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
        {article.author || 'TSOP'}
      </span>
      <Overline>{article.read_time} MIN</Overline>
    </div>
  </Link>
);

export const HomeMockup = () => {
  const [articles, setArticles] = useState([]);
  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, canAccessPremium } = useAuth();

  // ?preview=member forces the logged-in paid view for design review
  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;
  const memberName =
    (user && (user.name || user.email)) ||
    (previewMember ? 'Venkatesh' : null);

  // Reading history (for logged-in continue-reading rail)
  const [history, setHistory] = useState([]);
  useEffect(() => {
    setHistory(getReadingHistory().slice(0, 1));
  }, []);

  // Full typography system A/B switcher — display + body + label, all together
  const SYSTEMS = {
    newsreader: {
      label: 'Newsreader',
      blurb: 'Single family · newspaper of record',
      display: 'Newsreader',
      body: 'Newsreader',
      tracking: '0.16em',
    },
    'fraunces-geist': {
      label: 'Fraunces × Geist',
      blurb: 'Modern editorial · two families',
      display: 'Fraunces',
      body: 'Geist',
      tracking: '0.14em',
    },
    spectral: {
      label: 'Spectral',
      blurb: 'Long-form magazine · single family',
      display: 'Spectral',
      body: 'Spectral',
      tracking: '0.16em',
    },
    'playfair-plex': {
      label: 'Playfair × Plex',
      blurb: 'Original baseline',
      display: 'Playfair Display',
      body: 'IBM Plex Sans',
      tracking: '0.22em',
    },
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
          setHero(posts[0]);
          setArticles(posts.slice(1));
        }
      } catch (e) {
        console.error('Failed to fetch articles', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <Overline>Loading edition…</Overline>
      </div>
    );
  }

  const sideArticles = articles.slice(0, 3);
  const columnArticles = articles.slice(3, 7);
  const restArticles = articles.slice(7);

  // Today's date in masthead format e.g. "WEDNESDAY · 12 MARCH 2026"
  const today = new Date();
  const masthead = today
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase();

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

      {/* Typography SYSTEM picker — design review only */}
      <div
        data-testid="system-toggle"
        className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white border border-white/10 shadow-2xl"
      >
        <div className="px-5 py-3 border-b border-white/10">
          <span className="text-[10px] tracking-[0.22em] uppercase text-white/40">
            Typography system
          </span>
        </div>
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
            >
              <div
                className="text-base font-medium"
                style={{ fontFamily: `'${s.display}', serif` }}
              >
                {s.label}
              </div>
              <div
                className={`text-[10px] tracking-[0.18em] uppercase mt-0.5 ${
                  systemKey === key ? 'text-[#0F172A]/60' : 'text-white/40'
                }`}
                style={{ fontFamily: `'${s.body}', sans-serif` }}
              >
                {s.blurb}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MASTHEAD STRIP */}
      <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F7F7F5] dark:bg-[#090E17]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          {isMember ? (
            <>
              <Overline className="text-[#234ba0]">
                Welcome Back{memberName ? ` · ${memberName}` : ''}
              </Overline>
              <Overline className="hidden sm:block">{masthead}</Overline>
              <Link
                to="/account"
                data-testid="mockup-account-link"
                className="inline-flex items-center gap-2 font-plex tabular-nums text-[10px] md:text-[11px] font-medium tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0] transition-colors duration-200"
              >
                Member Lounge
                <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            </>
          ) : (
            <>
              <Overline>The State of Play · Edition</Overline>
              <Overline className="hidden sm:block">{masthead}</Overline>
              <Overline className="text-[#234ba0]">Issue Nº 014</Overline>
            </>
          )}
        </div>
      </div>

      {/* HERO MAGAZINE BLOCK */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
          {/* Section eyebrow */}
          <div className="flex items-end justify-between mb-12 lg:mb-16">
            <div>
              <Overline className="text-[#234ba0] mb-3 block">
                {isMember ? 'Today’s Edition · For Members' : 'Today’s Edition'}
              </Overline>
              {isMember ? (
                <>
                  <h1 className="font-editorial font-semibold tracking-tight text-[2.25rem] sm:text-5xl lg:text-[3.5rem] leading-[1.02] max-w-3xl">
                    Good to see you,{' '}
                    <em className="italic font-normal text-[#234ba0]">
                      {memberName ? memberName.split('@')[0] : 'reader'}.
                    </em>
                  </h1>
                  <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mt-5 max-w-2xl leading-relaxed">
                    Three new pieces in the desk since you last visited. Pick up where you left off, or start fresh below.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-editorial font-semibold tracking-tight text-[2.25rem] sm:text-5xl lg:text-[3.5rem] leading-[1.02] max-w-3xl">
                    The business of sport,{' '}
                    <em className="italic font-normal text-[#234ba0]">from an India lens.</em>
                  </h1>
                  <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mt-5 max-w-2xl leading-relaxed">
                    Deep-dive analysis, exclusive insights, and the untold stories behind Indian sports business — for investors, leagues, and agencies.
                  </p>
                </>
              )}
            </div>

            <Link
              to="/state-of-play"
              data-testid="mockup-hero-archive-link"
              className="hidden lg:inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200"
            >
              All Stories
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>

          {/* Continue Reading rail — members only, only if there's history */}
          {isMember && history.length > 0 && (
            <div className="mb-12 lg:mb-16 border-y border-[#0F172A] dark:border-[#F8FAFC] py-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <Overline className="text-[var(--accent)] shrink-0">
                Continue Reading
              </Overline>
              <Link
                to={`/${history[0].id}`}
                data-testid="mockup-continue-reading"
                className="group flex-1 flex items-center justify-between gap-6"
              >
                <h3 className="font-editorial font-semibold text-lg lg:text-xl leading-snug text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#234ba0] transition-colors duration-200">
                  {history[0].title}
                </h3>
                <div className="flex items-center gap-3 shrink-0">
                  <Overline>{history[0].read_time} MIN LEFT</Overline>
                  <ArrowUpRight
                    className="h-4 w-4 text-[#94A3B8] group-hover:text-[#234ba0] transition-colors duration-200"
                    strokeWidth={1.5}
                  />
                </div>
              </Link>
            </div>
          )}

          {/* Bento: hero (8) + side rail (4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
            {hero && <HeroArticle article={hero} />}
            <aside className="lg:col-span-4 lg:pl-12 xl:pl-16">
              <div className="mb-8">
                <Overline className="text-[#234ba0]">Also Reading</Overline>
              </div>
              {sideArticles.map((a, i) => (
                <SideArticle
                  key={a.id}
                  article={a}
                  isLast={i === sideArticles.length - 1}
                />
              ))}
            </aside>
          </div>
        </div>
      </section>

      {/* PULL QUOTE / EDITORIAL FLAIR */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-2">
              <Overline className="text-[var(--accent)]">Editor’s Note</Overline>
            </div>
            <blockquote className="lg:col-span-9 border-l-4 border-[var(--accent)] pl-8 lg:pl-12">
              <p className="font-editorial italic text-2xl sm:text-3xl lg:text-[2.5rem] leading-[1.18] text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                “Billions are moving into Indian sport. The State of Play is where you find out where, why, and at what price.”
              </p>
              <footer className="mt-8 flex items-center gap-3">
                <span className="h-px w-12 bg-[#0F172A] dark:bg-[#F8FAFC]" />
                <Overline>Venkat Ananth · Founding Editor</Overline>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* PRINT-COLUMN GRID — newspaper feel */}
      {columnArticles.length > 0 && (
        <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
            <div className="flex items-end justify-between mb-12">
              <div>
                <Overline className="text-[#234ba0] mb-3 block">The Desk</Overline>
                <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                  Recent editions.
                </h2>
              </div>
              <Overline className="hidden md:block">
                {columnArticles.length.toString().padStart(2, '0')} Stories
              </Overline>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 lg:divide-x lg:divide-[#E2E8F0] dark:lg:divide-[#1E293B]">
              {columnArticles.map((a, i) => (
                <ColumnCard key={a.id} article={a} idx={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MORE FROM THE DESK — list view */}
      {restArticles.length > 0 && (
        <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
            <div className="flex items-end justify-between mb-12">
              <div>
                <Overline className="text-[#234ba0] mb-3 block">More Reading</Overline>
                <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                  From the archive.
                </h2>
              </div>
            </div>

            <ul className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
              {restArticles.map((a, i) => (
                <li key={a.id}>
                  <Link
                    to={`/${a.id}`}
                    data-testid={`mockup-list-${a.id}`}
                    className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-6 lg:py-8 border-b border-[#E2E8F0] dark:border-[#1E293B] hover:bg-[#F1F1EE] dark:hover:bg-[#0F172A] -mx-3 px-3 transition-colors duration-200"
                  >
                    <span className="hidden md:block col-span-1 font-plex tabular-nums text-[11px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="col-span-12 md:col-span-2">
                      <Overline className="text-[#234ba0]">
                        {a.theme || 'Analysis'}
                      </Overline>
                    </div>
                    <h3 className="col-span-12 md:col-span-7 font-editorial font-semibold tracking-tight text-xl lg:text-[1.5rem] leading-[1.2] text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#234ba0] transition-colors duration-200">
                      {a.title}
                    </h3>
                    <div className="hidden md:flex col-span-2 items-center justify-end gap-3">
                      <Overline>{fmtDate(a.created_at)}</Overline>
                      <ArrowUpRight
                        className="h-4 w-4 text-[#94A3B8] group-hover:text-[#234ba0] transition-colors duration-200"
                        strokeWidth={1.5}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* TESTIMONIALS — placeholder section, logged-out only */}
      {!isMember && (
        <section
          data-testid="testimonials-placeholder"
          className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]"
        >
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
            <div className="flex items-end justify-between mb-12 lg:mb-16">
              <div>
                <Overline className="text-[var(--accent)] mb-3 block">— On record —</Overline>
                <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                  What the room is saying.
                </h2>
                <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mt-3 max-w-[55ch]">
                  Quotes from subscribers — pending commission. Three slots reserved below for senior voices across funds, leagues and agencies.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2E8F0] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B]">
              {[
                'Investor · Mumbai',
                'League Executive · Bengaluru',
                'Agency Partner · New Delhi',
              ].map((role, i) => (
                <div
                  key={role}
                  className="bg-[#F7F7F5] dark:bg-[#090E17] p-8 lg:p-10 flex flex-col"
                >
                  <Overline className="text-[#94A3B8] mb-6">
                    {String(i + 1).padStart(2, '0')} · Quote pending
                  </Overline>
                  <blockquote className="flex-1 mb-6">
                    <p className="font-editorial italic text-xl lg:text-[1.5rem] leading-snug text-[#94A3B8] dark:text-[#475569]">
                      “[ Subscriber quote to be commissioned. A short paragraph that names a specific reason TSOP is read — a deal, a brief, a number — in their own voice. ]”
                    </p>
                  </blockquote>
                  <footer className="pt-5 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                    <Overline className="text-[#0F172A] dark:text-[#F8FAFC]">
                      [ Name · Title ]
                    </Overline>
                    <Overline className="block mt-1">{role}</Overline>
                  </footer>
                </div>
              ))}
            </div>

            <p className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-[#94A3B8] mt-8 text-center">
              Section reserved · content pending editorial sign-off
            </p>
          </div>
        </section>
      )}

      {/* SUBSCRIBE (logged-out) / MEMBER LOUNGE (logged-in) */}
      {isMember ? (
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 lg:mb-16">
              <div>
                <Overline className="text-[var(--accent)] mb-5 block">Member Lounge</Overline>
                <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3.5rem] leading-[1.05] text-white">
                  Yours, exclusively.
                </h2>
                <p className="font-plex text-lg leading-relaxed text-white/70 mt-5 max-w-2xl">
                  Tools and rooms reserved for paying members of The State of Play.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/15 border-y border-white/15">
              <Link
                to="/account"
                data-testid="lounge-account"
                className="group block py-10 md:py-12 md:px-10 first:md:pl-0 last:md:pr-0"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] text-white/40 tabular-nums">01</span>
                  <span className="h-px w-6 bg-white/30" />
                  <Overline className="text-white/70">Your Account</Overline>
                </div>
                <h3 className="font-editorial font-semibold text-2xl lg:text-[1.75rem] leading-tight text-white mb-3 group-hover:text-[var(--accent)] transition-colors duration-200">
                  Plan, billing & preferences.
                </h3>
                <p className="font-plex text-sm text-white/60 leading-relaxed mb-5">
                  Manage your subscription, swap plans, or update reading preferences in one place.
                </p>
                <span className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 group-hover:text-white group-hover:border-white transition-colors duration-200">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </span>
              </Link>

              <Link
                to="/account"
                data-testid="lounge-reading-list"
                className="group block py-10 md:py-12 md:px-10"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] text-white/40 tabular-nums">02</span>
                  <span className="h-px w-6 bg-white/30" />
                  <Overline className="text-white/70">Reading List</Overline>
                </div>
                <h3 className="font-editorial font-semibold text-2xl lg:text-[1.75rem] leading-tight text-white mb-3 group-hover:text-[var(--accent)] transition-colors duration-200">
                  Saved for later.
                </h3>
                <p className="font-plex text-sm text-white/60 leading-relaxed mb-5">
                  Bookmark deep-dives and revisit them on your schedule. Synced across devices.
                </p>
                <span className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 group-hover:text-white group-hover:border-white transition-colors duration-200">
                  View
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </span>
              </Link>

              <Link
                to="/account"
                data-testid="lounge-insider-drops"
                className="group block py-10 md:py-12 md:px-10 first:md:pl-0 last:md:pr-0"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] text-white/40 tabular-nums">03</span>
                  <span className="h-px w-6 bg-white/30" />
                  <Overline className="text-[var(--accent)]">Insider Drops · Soon</Overline>
                </div>
                <h3 className="font-editorial font-semibold text-2xl lg:text-[1.75rem] leading-tight text-white mb-3 group-hover:text-[var(--accent)] transition-colors duration-200">
                  Private intel, off the record.
                </h3>
                <p className="font-plex text-sm text-white/60 leading-relaxed mb-5">
                  Subscriber-only feed of deal whispers, tip-offs and short notes — published as they break.
                </p>
                <span className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-white/40 border-b border-white/20 pb-1">
                  Notify Me
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </span>
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              <div className="lg:col-span-7">
                <Overline className="text-[var(--accent)] mb-5 block">Subscribe</Overline>
                <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3.5rem] leading-[1.05] text-white mb-6">
                  Read the room before everyone else does.
                </h2>
                <p className="font-plex text-lg leading-relaxed text-white/70 max-w-2xl">
                  Premium analysis of the businesses, deals and people moving Indian sport — delivered weekly. Trusted by analysts at the funds, leagues and agencies actually doing the work.
                </p>
              </div>
              <div className="lg:col-span-5 flex flex-col gap-5 lg:items-end">
                <Link
                  to="/signup"
                  data-testid="mockup-subscribe-cta"
                  className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
                >
                  Subscribe
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <Link
                  to="/teams"
                  data-testid="mockup-teams-cta"
                  className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
                >
                  For Teams & Funds
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* COLOPHON */}
      <MockupFooter />
    </div>
  );
};

export default HomeMockup;
