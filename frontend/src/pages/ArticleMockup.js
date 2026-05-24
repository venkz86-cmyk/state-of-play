import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowUpRight, Share2, Bookmark } from 'lucide-react';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();
};

const Overline = ({ children, className = '' }) => (
  <span
    className={`font-plex tabular-nums text-[10px] md:text-[11px] font-medium tracking-[0.22em] uppercase text-[#475569] ${className}`}
  >
    {children}
  </span>
);

const ACCENTS = {
  orange: { hex: '#FF6B35', hover: '#e55e2d', label: 'Orange' },
  gold:   { hex: '#B8923F', hover: '#9B7A2F', label: 'Gold' },
  burgundy: { hex: '#8B1E2D', hover: '#6f1824', label: 'Burgundy' },
  slate:  { hex: '#475569', hover: '#334155', label: 'Slate' },
};

export const ArticleMockup = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canAccessPremium } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;
  const bodyVariant = searchParams.get('body') === 'serif' ? 'serif' : 'sans';
  const accentKey = ACCENTS[searchParams.get('accent')] ? searchParams.get('accent') : 'burgundy';
  const accent = ACCENTS[accentKey];

  const setBodyVariant = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'serif') next.set('body', 'serif');
    else next.delete('body');
    setSearchParams(next, { replace: true });
  };

  const setAccent = (k) => {
    const next = new URLSearchParams(searchParams);
    if (k && k !== 'burgundy') next.set('accent', k);
    else next.delete('accent');
    setSearchParams(next, { replace: true });
  };

  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let post;
        if (id) {
          post = await ghostAPI.getPost(id);
        } else {
          const posts = await ghostAPI.getPosts({ limit: 1 });
          post = posts[0];
        }
        if (!active) return;
        setArticle(post);

        // pull a few related/recent ones (excluding current)
        const recent = await ghostAPI.getPosts({ limit: 6 });
        if (!active) return;
        setRelated(recent.filter((p) => p.id !== post?.id).slice(0, 3));
      } catch (e) {
        console.error('Failed to load article', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(100, (top / h) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] flex items-center justify-center">
        <Overline>Loading article…</Overline>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] flex items-center justify-center px-6 text-center">
        <div>
          <Overline>Not found</Overline>
          <h1 className="font-editorial font-semibold text-3xl mt-3 text-[#0F172A] dark:text-[#F8FAFC]">
            We couldn’t find that piece.
          </h1>
          <Link
            to="/mockup/home"
            className="inline-flex items-center gap-2 mt-6 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1"
          >
            Back to homepage
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    );
  }

  const isPaywalled = article.is_premium && !isMember;
  const bodyHtml = isPaywalled ? article.preview_content : article.content;

  return (
    <div
      className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] text-[#0F172A] dark:text-[#F8FAFC]"
      style={{ '--accent': accent.hex, '--accent-hover': accent.hover }}
      data-testid="mockup-article"
    >
      <MockupHeader />

      {/* Body-font + accent A/B switcher — design review only */}
      <div
        data-testid="font-toggle"
        className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white border border-white/10 shadow-lg"
      >
        <div className="flex items-stretch divide-x divide-white/10 border-b border-white/10">
          <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase px-4 py-3 text-white/40">
            Body
          </span>
          <button
            type="button"
            onClick={() => setBodyVariant('sans')}
            data-testid="font-toggle-sans"
            className={`font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase px-4 py-3 transition-colors duration-200 ${
              bodyVariant === 'sans' ? 'bg-white text-[#0F172A]' : 'hover:text-white text-white/70'
            }`}
          >
            Sans · Plex
          </button>
          <button
            type="button"
            onClick={() => setBodyVariant('serif')}
            data-testid="font-toggle-serif"
            className={`font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase px-4 py-3 transition-colors duration-200 ${
              bodyVariant === 'serif' ? 'bg-white text-[#0F172A]' : 'hover:text-white text-white/70'
            }`}
          >
            Serif · Source
          </button>
        </div>
        <div className="flex items-stretch divide-x divide-white/10">
          <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase px-4 py-3 text-white/40">
            Accent
          </span>
          {Object.entries(ACCENTS).map(([key, a]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAccent(key)}
              data-testid={`accent-toggle-${key}`}
              className={`font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase px-3 py-3 transition-colors duration-200 flex items-center gap-2 ${
                accentKey === key ? 'bg-white text-[#0F172A]' : 'hover:text-white text-white/70'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5"
                style={{ backgroundColor: a.hex }}
                aria-hidden="true"
              />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reading progress — Bloomberg-style hairline bar */}
      <div
        aria-hidden="true"
        className="fixed top-16 lg:top-20 left-0 right-0 z-40 h-[2px] bg-transparent"
      >
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Editorial frame: section eyebrow + back link */}
      <div className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <Link
            to="/mockup/home"
            data-testid="article-back-home"
            className="inline-flex items-center gap-2 font-plex tabular-nums text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0] transition-colors duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            All Stories
          </Link>
          <Overline className="hidden sm:block">
            {article.publication || 'The State of Play'}
          </Overline>
          <Overline className="text-[#234ba0]">{fmtDate(article.created_at)}</Overline>
        </div>
      </div>

      {/* TITLE BLOCK */}
      <header className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-16 lg:pt-24 pb-12 lg:pb-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-7">
              {article.theme && (
                <Overline className="text-[#234ba0]">{article.theme}</Overline>
              )}
              {article.is_premium && (
                <>
                  <span className="h-px w-6 bg-[#234ba0]/40" />
                  <Overline className="text-[var(--accent)]">Subscribers Only</Overline>
                </>
              )}
            </div>

            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.02] text-[#0F172A] dark:text-[#F8FAFC] mb-8">
              {article.title}
            </h1>

            {article.subtitle && (
              <p className="font-plex text-xl lg:text-2xl leading-snug text-[#475569] dark:text-[#94A3B8] max-w-[60ch]">
                {article.subtitle}
              </p>
            )}

            {/* Byline strip */}
            <div className="mt-12 pt-6 border-t border-[#E2E8F0] dark:border-[#1E293B] flex flex-wrap items-center gap-x-5 gap-y-3 justify-between">
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 bg-[#0F172A] dark:bg-[#F8FAFC] text-[#F7F7F5] dark:text-[#090E17] flex items-center justify-center font-editorial text-base">
                  {(article.author || 'T').charAt(0).toUpperCase()}
                </span>
                <div className="leading-tight">
                  <div className="font-plex text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                    By {article.author || 'TSOP Editorial'}
                  </div>
                  <Overline>{article.read_time} min read</Overline>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <button
                  type="button"
                  data-testid="article-share"
                  className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0] transition-colors duration-200"
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Share
                </button>
                <button
                  type="button"
                  data-testid="article-bookmark"
                  className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0] transition-colors duration-200"
                >
                  <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* HERO IMAGE — full container, mono caption */}
      {article.image_url && (
        <figure className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="max-w-[1400px] mx-auto">
            <div className="relative w-full aspect-[16/9] bg-[#F1F1EE] overflow-hidden">
              <img
                src={article.image_url}
                alt={article.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          {article.image_caption && (
            <figcaption className="max-w-[1400px] mx-auto px-6 lg:px-12 py-4 text-right">
              <Overline>{article.image_caption.replace(/<[^>]+>/g, '')}</Overline>
            </figcaption>
          )}
        </figure>
      )}

      {/* ARTICLE BODY */}
      <article className="bg-[#F7F7F5] dark:bg-[#090E17]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div
            className={`editorial-prose ${bodyVariant === 'serif' ? 'editorial-prose--serif' : ''} font-plex max-w-[65ch] mx-auto text-[#0F172A] dark:text-[#F8FAFC]`}
            data-testid="article-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml || '' }}
          />

          {/* Inline pull-quote — sample editorial flair */}
          {!isPaywalled && bodyHtml && bodyHtml.length > 800 && (
            <aside className="max-w-[65ch] mx-auto my-16 lg:my-20">
              <blockquote className="border-l-4 border-[var(--accent)] pl-6 lg:pl-10 py-2">
                <p className="font-editorial italic text-2xl lg:text-[2rem] leading-[1.2] text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                  “{(article.subtitle || article.title || '').replace(/[“”"]/g, '')}”
                </p>
                <footer className="mt-4 flex items-center gap-3">
                  <span className="h-px w-8 bg-[#0F172A] dark:bg-[#F8FAFC]" />
                  <Overline>{article.author || 'TSOP'}</Overline>
                </footer>
              </blockquote>
            </aside>
          )}

          {/* PAYWALL BLOCK — only when locked */}
          {isPaywalled && (
            <div
              data-testid="article-paywall"
              className="max-w-[65ch] mx-auto mt-12 border-t border-[#0F172A] dark:border-[#F8FAFC] pt-12"
            >
              <Overline className="text-[var(--accent)] mb-4 block">Continue Reading</Overline>
              <h2 className="font-editorial font-semibold text-3xl lg:text-[2.5rem] leading-[1.08] text-[#0F172A] dark:text-[#F8FAFC] mb-5">
                The rest of this piece is for subscribers.
              </h2>
              <p className="font-plex text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-8 max-w-[55ch]">
                Independent, deeply-reported analysis of the businesses, deals and people moving Indian sport. Read in full when you become a member.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <Link
                  to="/signup"
                  data-testid="paywall-subscribe"
                  className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-8 py-4 text-base tracking-wide transition-colors duration-200"
                >
                  Subscribe to Continue
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <Link
                  to="/login"
                  data-testid="paywall-login"
                  className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200 self-start sm:self-center"
                >
                  Already a subscriber? Sign in
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* AUTHOR / END SLUG */}
      <section className="border-y border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
          <div className="max-w-3xl mx-auto">
            <Overline className="text-[#234ba0] mb-4 block">— End of Piece —</Overline>
            <p className="font-editorial italic text-xl lg:text-2xl leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-6">
              Reported and written by {article.author || 'The TSOP Editorial Desk'}.
            </p>
            <p className="font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] max-w-[60ch]">
              The State of Play publishes deep-dive analysis on the business of Indian sport — for the investors, leagues and agencies actually moving the market.
            </p>
          </div>
        </div>
      </section>

      {/* RELATED — print column style */}
      {related.length > 0 && (
        <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
            <div className="flex items-end justify-between mb-12">
              <div>
                <Overline className="text-[#234ba0] mb-3 block">Keep Reading</Overline>
                <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                  Continue the desk.
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-[#E2E8F0] dark:lg:divide-[#1E293B]">
              {related.map((a, i) => (
                <Link
                  key={a.id}
                  to={`/mockup/article/${a.id}`}
                  data-testid={`related-${a.id}`}
                  className="group block py-10 lg:py-0 lg:px-8 first:lg:pl-0 last:lg:pr-0 border-t border-[#E2E8F0] dark:border-[#1E293B] lg:border-t-0"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {a.theme && (
                      <>
                        <span className="h-px w-4 bg-[#CBD5E1]" />
                        <Overline className="text-[#234ba0]">{a.theme}</Overline>
                      </>
                    )}
                  </div>
                  {a.image_url && (
                    <div className="aspect-[3/2] overflow-hidden bg-[#F1F1EE] mb-5">
                      <img
                        src={a.image_url}
                        alt={a.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover saturate-[0.85] group-hover:saturate-100 group-hover:scale-[1.04] transition-all duration-700 ease-out"
                      />
                    </div>
                  )}
                  <h3 className="font-editorial font-semibold tracking-tight text-2xl leading-[1.18] text-[#0F172A] dark:text-[#F8FAFC] mb-3 group-hover:text-[#234ba0] transition-colors duration-200">
                    {a.title}
                  </h3>
                  <Overline>{a.read_time} MIN · {fmtDate(a.created_at)}</Overline>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <MockupFooter />
    </div>
  );
};

export default ArticleMockup;
