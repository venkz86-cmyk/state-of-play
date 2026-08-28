import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';
import { ShareRow } from '../components/ShareRow';
import { addToReadingHistory } from '../components/ReadingHistory';
import { ColdLinkAdminButton } from '../components/ColdLinkAdminButton';
import { NominateReaderBlock } from '../components/NominateReaderBlock';
import { PrintInterceptBlock } from '../components/PrintInterceptBlock';
import { GiftArticleModal } from '../components/GiftArticleModal';
import { MockupFontSizeToggle, useArticleSize } from '../components/MockupFontSizeToggle';
import { Paywall } from '../components/Paywall';
import { ReadingProgress } from '../components/ReadingProgress';
import { ContinueReading } from '../components/ContinueReading';
import { CustomComments } from '../components/CustomComments';
import { SEO } from '../components/SEO';
import { NotFoundMockup } from './NotFoundMockup';

const API = process.env.REACT_APP_BACKEND_URL;

const VENKAT_LINKEDIN_URL = 'https://www.linkedin.com/in/venkat-ananth/';
const VENKAT_X_URL = 'https://x.com/venkatananth';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const SectionLabel = ({ children, className = '' }) => (
  <p className={`section-label ${className}`}>{children}</p>
);

/* Truncate Ghost HTML to a preview slice before the paywall. Scales with
   article length (roughly a third of the piece) instead of a fixed
   paragraph count, so a short piece doesn't give away most of itself and
   a long feature doesn't wall off after a token taste. Floor of 2
   paragraphs, cap of 6 so the preview never runs too long either way. */
const previewParagraphs = (html) => {
  if (!html) return '';
  const all = html.match(/<p[\s\S]*?<\/p>/gi) || [];
  const count = Math.max(2, Math.min(6, Math.round(all.length * 0.35)));
  return all.slice(0, count).join('\n');
};

export const ArticleMockup = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { canAccessPremium, user } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;

  // Effective subscriber identity — used by the nominate quota fetch. In
  // preview-member mode there is no real user, so use a synthetic address
  // that clearly signals the request came from a preview session.
  const effectiveSubscriberEmail =
    user?.email || (previewMember ? 'preview-member@stateofplay.club' : '');
  const effectiveSubscriberName = user?.name || (previewMember ? 'Preview Member' : '');
  const effectiveSubscriberGhostId = user?.id || '';

  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useArticleSize();
  const [giftModalOpen, setGiftModalOpen] = useState(false);

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
        addToReadingHistory(post);
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
  // from the Admin API. The Content API truncates body at the paywall,
  // so until this resolves, article.content is still the truncated
  // preview even for a paying member — fullContentReady gates the page
  // render so they never see that flash of cut-off text before the
  // real content pops in.
  const [fullContentReady, setFullContentReady] = useState(false);
  useEffect(() => {
    let active = true;
    if (!article) return;
    const needsFullContent = !!(article.is_premium && user?.is_paid && user?.email && API);
    if (!needsFullContent) {
      setFullContentReady(true);
      return;
    }
    setFullContentReady(false);
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
      } finally {
        if (active) setFullContentReady(true);
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

  // Headline, dek, byline and hero image are already in hand from the
  // first fetch — no reason to blank the whole page while the full body
  // text is still loading for a paying member. Only the body area itself
  // gets a placeholder.
  const bodyStillLoading = article.is_premium && isMember && !fullContentReady;

  const isPaywalled = article.is_premium && !isMember;
  const bodyHtml = isPaywalled
    ? previewParagraphs(article.content)
    : (article.content || article.preview_content || '');
  const beat = article.theme;
  const articleTags = article.tags?.length > 0
    ? article.tags
    : [{ name: beat, slug: article.primary_tag_slug }];
  const isVenkatByline = !article.author || article.author === 'Venkat Ananth';

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
          <span className="font-plex text-[14px] text-[var(--text-muted)]">
            <Link to="/" className="hover:text-[var(--accent-burgundy)] transition-colors duration-200">
              ← The State of Play
            </Link>
            <span className="mx-2 text-[var(--text-label)]">·</span>
            {datelineDate(new Date(article.created_at))}
          </span>
          <span className="font-plex text-[14px] text-[var(--text-muted)] tabular-nums">
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
            <p className="font-reading italic text-[19px] md:text-[22px] leading-[1.5] text-[var(--text)] mb-6 max-w-[55ch]">
              {article.subtitle}
            </p>
          )}
          <p className="font-plex text-[14px] text-[var(--text)] mb-6">
            By {article.author || 'Venkat Ananth'}
            {article.read_time ? <span className="text-[var(--text-label)]"> · {article.read_time} min read</span> : null}
            {isVenkatByline && (
              <>
                <span className="text-[var(--text-label)]"> · </span>
                <a
                  href={VENKAT_LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="byline-linkedin"
                  className="text-[var(--text-label)] hover:text-[var(--text)] transition-colors duration-200"
                >
                  LinkedIn
                </a>
                <span className="text-[var(--text-label)]"> · </span>
                <a
                  href={VENKAT_X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="byline-x"
                  className="text-[var(--text-label)] hover:text-[var(--text)] transition-colors duration-200"
                >
                  X
                </a>
              </>
            )}
          </p>

          <ColdLinkAdminButton
            user={user}
            postSlug={article.slug || article.id}
            isPremium={!!article.is_premium}
          />

          {/* Utility strip: Text-size toggle (leftmost, prioritised for
              discoverability per audit) + Share row */}
          <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6 pt-4 border-t border-[var(--rule)]">
            <MockupFontSizeToggle value={size} onChange={setSize} />
            <ShareRow
              title={article.title}
              onGiftClick={isMember ? () => setGiftModalOpen(true) : undefined}
            />
          </div>
        </header>

        {!isPaywalled && !bodyStillLoading && <ContinueReading articleId={article.id} />}

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

        {bodyStillLoading ? (
          <div className="editorial-prose-quiet" data-testid="article-body-loading" data-size={size}>
            {[100, 92, 96, 60, 0, 88, 100, 94, 72].map((w, i) =>
              w === 0 ? (
                <div key={i} className="h-6" aria-hidden="true" />
              ) : (
                <div
                  key={i}
                  className="h-4 mb-3 bg-[var(--rule)] animate-pulse"
                  style={{ width: `${w}%` }}
                  aria-hidden="true"
                />
              )
            )}
          </div>
        ) : (
          <div
            className="editorial-prose-quiet"
            data-testid="article-body"
            data-size={size}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}

        {isPaywalled && <Paywall />}

        {!isPaywalled && (
          <div className="mt-12 pt-6 border-t border-[var(--rule)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="font-plex text-[13px] text-[var(--text-label)] flex flex-wrap items-baseline gap-x-2">
              <span>Filed under</span>
              {articleTags.map((t, i) => (
                <span key={t.slug || t.name}>
                  {t.slug ? (
                    <Link
                      to={`/archive?tag=${t.slug}`}
                      data-testid={`article-tag-${t.slug}`}
                      className="text-[var(--text-label)] underline underline-offset-[4px] decoration-1 hover:text-[var(--accent-burgundy)] transition-colors"
                    >
                      {t.name}
                    </Link>
                  ) : (
                    <span>{t.name}</span>
                  )}
                  {i < articleTags.length - 1 ? ',' : ''}
                </span>
              ))}
            </p>
            <p className="font-plex text-[13px] text-[var(--text-label)] tabular-nums">
              {longDate(article.created_at)}
            </p>
          </div>
        )}
      </article>

      {/* Comments — real Ghost member threads for subscribers; a subscribe
          nudge for everyone else. Gated the same as the rest of the page:
          members only, matching Ghost's own comments setting. Sits right
          after the article since it's a direct continuation of it, ahead
          of the separate Nominate-a-reader action below. */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-20">
        <div className="border-t border-[var(--rule)] pt-8 max-w-[680px]">
          <SectionLabel className="mb-3 block">Comments</SectionLabel>
          {isMember ? (
            <CustomComments
              postSlug={article.id}
              user={{ email: effectiveSubscriberEmail, name: effectiveSubscriberName }}
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>

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
                    <SectionLabel className="mb-2 block">{a.theme}</SectionLabel>
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

      {isMember && (
        <section className="max-w-[680px] mx-auto px-6 lg:px-0 pb-16 lg:pb-20">
          <NominateReaderBlock
            variant="story"
            subscriberName={effectiveSubscriberName}
            subscriberEmail={effectiveSubscriberEmail}
            subscriberGhostId={effectiveSubscriberGhostId}
            postSlug={article?.slug || article?.id || ''}
          />
        </section>
      )}

      <MockupFooter />

      {/* Print / Save-as-PDF intercept. Hidden on screen; activates on @media print */}
      <PrintInterceptBlock
        isPaidSubscriber={!!isMember}
        subscriberName={effectiveSubscriberName}
        subscriberEmail={effectiveSubscriberEmail}
        subscriberGhostId={effectiveSubscriberGhostId}
        articleSlug={article?.slug || article?.id || ''}
      />

      {/* Gift-article modal — opened via the Gift icon in the ShareRow.
          Uses the same backend as nominations; only reader-facing copy
          differs. Only bound for subscribers via onGiftClick above. */}
      <GiftArticleModal
        open={giftModalOpen}
        onOpenChange={setGiftModalOpen}
        isPaidSubscriber={!!isMember}
        subscriberName={effectiveSubscriberName}
        subscriberEmail={effectiveSubscriberEmail}
        subscriberGhostId={effectiveSubscriberGhostId}
        postSlug={article?.slug || article?.id || ''}
        articleTitle={article?.title || ''}
      />
    </div>
  );
};

export default ArticleMockup;
