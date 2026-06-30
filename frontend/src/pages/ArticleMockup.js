import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';
import { ShareRow } from '../components/ShareRow';
import { ColdLinkAdminButton } from '../components/ColdLinkAdminButton';
import { NominateReaderBlock } from '../components/NominateReaderBlock';
import { MockupFontSizeToggle, useArticleSize } from '../components/MockupFontSizeToggle';
import { Paywall } from '../components/Paywall';
import { ReadingProgress } from '../components/ReadingProgress';
import { SEO } from '../components/SEO';
import { NotFoundMockup } from './NotFoundMockup';

const API = process.env.REACT_APP_BACKEND_URL;

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const SectionLabel = ({ children, className = '' }) => (
  <p className={`section-label ${className}`}>{children}</p>
);

/* Truncate Ghost HTML to first N <p> tags for the paywall preview. */
const previewParagraphs = (html, count = 3) => {
  if (!html) return '';
  const out = [];
  const re = /<p[\s\S]*?<\/p>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < count) {
    out.push(m[0]);
  }
  return out.join('\n');
};

export const ArticleMockup = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { canAccessPremium, user } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;

  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useArticleSize();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let post;
        if (id) post = await ghostAPI.getPost(id);
        else {
          const list = await ghostAPI.getPosts({ limit: 1 });
          post = list[0];
        }
        if (!active) return;
        setArticle(post);
        const rel = await ghostAPI.getRelatedPosts(post, 3);
        if (!active) return;
        setRelated(rel);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  // For paid members reading a premium article, fetch the full HTML
  // from the Admin API. The Content API truncates body at the paywall.
  useEffect(() => {
    let active = true;
    if (!article?.is_premium) return;
    if (!user?.is_paid || !user?.email || !API) return;

    (async () => {
      try {
        const r = await axios.post(
          `${API}/api/ghost/article-content`,
          { slug: article.id, email: user.email },
          { timeout: 10000 }
        );
        if (!active) return;
        if (r.data?.html) {
          setArticle((prev) => ({ ...prev, content: r.data.html }));
        }
      } catch (e) {
        console.error('Failed to load full article content:', e);
      }
    })();
    return () => { active = false; };
  }, [article?.is_premium, article?.id, user?.is_paid, user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <span className="font-plex text-sm text-[var(--text-muted)]">Loading…</span>
      </div>
    );
  }
  if (!article) {
    return <NotFoundMockup />;
  }

  const isPaywalled = article.is_premium && !isMember;
  const bodyHtml = isPaywalled
    ? previewParagraphs(article.content, 3)
    : (article.content || article.preview_content || '');
  const beat = article.theme || 'Long Read';

  return (
    <div
      className="theme-transition min-h-screen bg-[var(--bg)] text-[var(--text)]"
      data-testid="mockup-article"
    >
      <SEO
        title={article.title}
        description={article.subtitle || article.excerpt}
        path={`/${article.slug || article.id}`}
        image={`https://www.stateofplay.club/api/og-image/${article.slug || article.id}`}
        type="article"
        article={article}
      />
      <ReadingProgress />
      <MockupHeader />

      {/* DATELINE STRIP */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888]">
            <Link to="/" className="hover:text-[var(--accent-burgundy)] transition-colors duration-200">
              ← The State of Play
            </Link>
            <span className="mx-2 text-[var(--text-label)]">·</span>
            {datelineDate(new Date(article.created_at))}
          </span>
          <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888] tabular-nums">
            Year Two
          </span>
        </div>
      </div>

      {/* ARTICLE BODY — max 680px per spec */}
      <article className="max-w-[680px] mx-auto px-6 lg:px-0 pt-12 lg:pt-16 pb-20 lg:pb-24">
        <header className="mb-8 lg:mb-10">
          <SectionLabel className="mb-5">
            {beat}{article.is_premium ? ' · For Subscribers' : ' · Free'}
          </SectionLabel>
          <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[40px] leading-[1.08] text-[var(--text)] mb-5 max-w-[24ch]">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="font-reading italic text-[20px] leading-[1.6] text-[var(--text-muted)] mb-6 max-w-[55ch]">
              {article.subtitle}
            </p>
          )}
          <p className="font-plex text-[13px] text-[var(--text-label)] mb-6">
            By {article.author || 'Venkat Ananth'}
            {article.read_time ? <span> · {article.read_time} min read</span> : null}
          </p>

          <ColdLinkAdminButton
            user={user}
            postSlug={article.slug || article.id}
            isPremium={!!article.is_premium}
          />

          {/* Share row + Font-size toggle: left + right within the column */}
          <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6 pt-4 border-t border-[var(--rule)]">
            <ShareRow title={article.title} />
            <MockupFontSizeToggle value={size} onChange={setSize} />
          </div>
        </header>

        {article.image_url && (
          <figure className="mb-10 lg:mb-12 -mx-6 lg:mx-0 overflow-hidden">
            <img
              src={article.image_url}
              alt={article.title}
              referrerPolicy="no-referrer"
              className="w-full aspect-[16/9] object-cover saturate-0 hover:saturate-100 transition-all duration-700 ease-out"
            />
            {article.image_caption && (
              <figcaption className="font-plex text-[12px] italic text-[var(--text-label)] mt-3 px-6 lg:px-0">
                {article.image_caption.replace(/<[^>]+>/g, '')}
              </figcaption>
            )}
          </figure>
        )}

        <div
          className="editorial-prose-quiet"
          data-testid="article-body"
          data-size={size}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {isPaywalled && <Paywall />}

        {!isPaywalled && (
          <div className="mt-12 pt-6 border-t border-[var(--rule)] flex items-baseline justify-between">
            <p className="font-plex text-[13px] text-[var(--text-label)]">
              Filed under {beat}
            </p>
            <p className="font-plex text-[13px] text-[var(--text-label)] tabular-nums">
              {longDate(article.created_at)}
            </p>
          </div>
        )}
      </article>

      {canAccessPremium && (
        <section className="max-w-[680px] mx-auto px-6 lg:px-0 pb-16 lg:pb-20">
          <NominateReaderBlock
            variant="story"
            subscriberName={user?.name || ''}
            subscriberEmail={user?.email || ''}
            subscriberGhostId={user?.id || ''}
          />
        </section>
      )}

      {/* MORE ON THIS TOPIC — 2-3 related, no images, no deks */}
      {related.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-20 lg:pb-24">
          <div className="border-t border-[var(--rule)] pt-8">
            <SectionLabel className="mb-6 block">More on this topic</SectionLabel>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-0">
              {related.map((a) => (
                <li key={a.id} className="border-t border-[var(--rule)] md:border-t-0">
                  <Link
                    to={`/${a.id}`}
                    data-testid={`related-${a.id}`}
                    className="group block py-5"
                  >
                    <SectionLabel className="mb-2 block">{a.theme || 'Analysis'}</SectionLabel>
                    <h3 className="headline-lock font-editorial font-medium text-[17px] leading-snug mb-2">
                      {a.title}
                    </h3>
                    <p className="font-plex text-[12px] text-[var(--text-label)] tabular-nums">
                      {longDate(a.created_at)}
                      {a.read_time ? ` · ${a.read_time} min read` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Comments stub (Ghost integration deferred per user) */}
      {!isMember && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-20">
          <div className="border-t border-[var(--rule)] pt-8 max-w-[680px]">
            <SectionLabel className="mb-3 block">Comments</SectionLabel>
            <p className="font-plex text-[15px] text-[var(--text-muted)] mb-4 max-w-[55ch]">
              Comments are for members. Subscribe to join the conversation.
            </p>
            <Link
              to="/signup"
              data-testid="comments-subscribe"
              className="font-plex text-[14px] text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
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

export default ArticleMockup;
