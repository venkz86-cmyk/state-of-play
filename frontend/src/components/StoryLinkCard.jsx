import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { ghostSrcSet, sized } from '../lib/ghostImage';
import { splitStoryLinks } from '../lib/storyLinks';
import { StoryLabel } from './StoryLabel';

const longDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '');

export const StoryLinkCard = ({ post }) => (
  <Link
    to={`/${post.slug}`}
    className="group flex gap-4 sm:gap-5 border border-[var(--rule)] hover:border-[var(--text)] transition-colors duration-200 p-3 sm:p-4 no-underline"
    data-testid={`story-link-card-${post.slug}`}
  >
    {post.image_url && (
      <img
        src={sized(post.image_url, 600)}
        srcSet={ghostSrcSet(post.image_url, [600, 1000])}
        sizes="200px"
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-[96px] h-[72px] sm:w-[176px] sm:h-[110px] object-cover shrink-0"
      />
    )}
    <span className="flex flex-col min-w-0">
      <StoryLabel post={post} small as="span" className="mb-1.5" />
      <span className="font-editorial font-semibold text-[17px] sm:text-[20px] leading-snug text-[var(--text)]">
        {post.title}
      </span>
      {post.subtitle && (
        <span className="hidden sm:block font-plex text-[14px] leading-relaxed text-[var(--text-muted)] mt-1 line-clamp-2">
          {post.subtitle}
        </span>
      )}
      <span className="font-plex text-[12px] text-[var(--text-label)] mt-1.5 tabular-nums">
        {longDate(post.created_at)}{post.read_time ? ` · ${post.read_time} min read` : ''}
      </span>
    </span>
  </Link>
);

/* The story's HTML with "Also read" cards in place of bare story links.
   Until the story list arrives (and for any address that isn't a story),
   the original HTML shows, so nothing is lost or blank. */
export const StoryBody = ({ html, className, ...rest }) => {
  const segments = splitStoryLinks(html);
  const hasLinks = segments.some((s) => s.slugs);
  const [posts, setPosts] = useState(null);
  useEffect(() => {
    if (!hasLinks) return undefined;
    let active = true;
    ghostAPI.getAllPosts().then((list) => {
      if (active) setPosts(Object.fromEntries((list || []).map((p) => [p.slug, p])));
    }).catch(() => {});
    return () => { active = false; };
  }, [hasLinks]);

  if (!hasLinks) return <div className={className} {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <div className={className} {...rest}>
      {segments.map((s, i) => {
        const found = s.slugs && posts ? s.slugs.map((slug) => posts[slug]).filter(Boolean) : [];
        if (!s.slugs || !found.length) return <div key={i} dangerouslySetInnerHTML={{ __html: s.html }} />;
        return (
          <aside key={i} className="story-also-read my-10" data-testid="story-also-read">
            <div className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-3">Also read</div>
            <div className="flex flex-col gap-3">
              {found.map((p) => <StoryLinkCard key={p.slug} post={p} />)}
            </div>
          </aside>
        );
      })}
    </div>
  );
};

export default StoryBody;
