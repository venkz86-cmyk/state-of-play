import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const ArticleMockup = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { canAccessPremium } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;

  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

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
        const recent = await ghostAPI.getPosts({ limit: 4 });
        if (!active) return;
        setRelated(recent.filter((p) => p.id !== post?.id).slice(0, 3));
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <span className="text-sm text-[#475569]">Loading…</span>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-editorial text-2xl mb-3">Not found.</p>
          <Link to="/mockup/home" className="text-[var(--accent)] underline underline-offset-4">
            Back home
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
      data-testid="mockup-article"
    >
      <MockupHeader />

      {/* TITLE BLOCK — single column, no overlines, no avatar, no chrome */}
      <article className="max-w-[720px] mx-auto px-6 lg:px-0 pt-20 lg:pt-28 pb-24 lg:pb-32">
        <header className="mb-14 lg:mb-16">
          <h1 className="font-editorial font-semibold tracking-tight text-[2.25rem] sm:text-5xl lg:text-[3.5rem] leading-[1.05] text-[#0F172A] dark:text-[#F8FAFC] mb-7">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="font-plex text-xl lg:text-2xl leading-[1.4] text-[#334155] dark:text-[#CBD5E1] mb-10">
              {article.subtitle}
            </p>
          )}
          <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
            By {article.author || 'The State of Play'} · {fmtDate(article.created_at)}
            {article.read_time ? ` · ${article.read_time} min read` : ''}
          </p>
        </header>

        {article.image_url && (
          <figure className="mb-14 lg:mb-16 -mx-6 lg:mx-0">
            <img
              src={article.image_url}
              alt={article.title}
              referrerPolicy="no-referrer"
              className="w-full aspect-[16/9] object-cover"
            />
            {article.image_caption && (
              <figcaption className="font-plex text-xs text-[#94A3B8] mt-3 px-6 lg:px-0">
                {article.image_caption.replace(/<[^>]+>/g, '')}
              </figcaption>
            )}
          </figure>
        )}

        {/* BODY — typography only, no drop cap, no pull quote injection */}
        <div
          className="editorial-prose-quiet"
          data-testid="article-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml || '' }}
        />

        {/* PAYWALL — quiet, no big heading, no orange */}
        {isPaywalled && (
          <div
            data-testid="article-paywall"
            className="mt-16 pt-10 border-t border-[#0F172A] dark:border-[#F8FAFC]"
          >
            <p className="font-editorial italic text-xl lg:text-2xl leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-4 max-w-[50ch]">
              The rest of this piece is for subscribers.
            </p>
            <p className="font-plex text-base text-[#475569] dark:text-[#94A3B8] mb-6 max-w-[55ch]">
              ₹2,495 a year. Independent reporting on the business of Indian sport.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                to="/signup"
                data-testid="paywall-subscribe"
                className="font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
              >
                Subscribe →
              </Link>
              <Link
                to="/login"
                data-testid="paywall-login"
                className="font-plex text-base text-[#475569] dark:text-[#94A3B8] underline underline-offset-[6px] decoration-1 hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
              >
                Already a subscriber? Sign in
              </Link>
            </div>
          </div>
        )}
      </article>

      {/* RELATED — one quiet list, no eyebrow */}
      {related.length > 0 && (
        <section className="max-w-[720px] mx-auto px-6 lg:px-0 pb-24 lg:pb-32">
          <div className="border-t border-[#E2E8F0] dark:border-[#1E293B] pt-10">
            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mb-6">
              More from The State of Play
            </p>
            <ul>
              {related.map((a) => (
                <li key={a.id} className="border-b border-[#E2E8F0] dark:border-[#1E293B] last:border-b-0">
                  <Link
                    to={`/mockup/article/${a.id}`}
                    data-testid={`related-${a.id}`}
                    className="group block py-5"
                  >
                    <h3 className="font-editorial text-lg lg:text-xl leading-snug text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[var(--accent)] transition-colors duration-200">
                      {a.title}
                    </h3>
                    <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mt-1">
                      {fmtDate(a.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <MockupFooter />
    </div>
  );
};

export default ArticleMockup;
