import { useEffect, useState } from 'react';
import { ghostAPI } from '../services/ghostAPI';
import { ghostSrcSet, sized } from '../lib/ghostImage';
import { splitStoryLinks } from '../lib/storyLinks';
import { StoryLabel } from './StoryLabel';

const longDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '');

// Links in a story open in a new tab, so the reader keeps their place in it.
const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' };

// Every link in the story's text opens in a new tab, except jumps within
// the page (footnotes) and links that already say where to open.
export const linksInNewTab = (html) => (html || '').replace(
  /<a\s(?![^>]*\btarget=)([^>]*\bhref="(?!#)[^"]*"[^>]*)>/gi,
  '<a target="_blank" rel="noopener noreferrer" $1>',
);

export const StoryLinkCard = ({ post }) => (
  <a
    href={`/${post.slug}`}
    {...NEW_TAB}
    className="group flex gap-4 sm:gap-5 border border-[var(--rule)] hover:border-[var(--text)] transition-colors duration-200 p-3 sm:p-4 no-underline min-h-[120px] sm:min-h-[158px]"
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
  </a>
);

// Holds the card's space while the story details load, so the text
// below doesn't jump when the card appears. Both share a minimum height
// that fits a card with a two-line headline.
const CardPlaceholder = () => (
  <div className="flex gap-4 sm:gap-5 border border-[var(--rule)] p-3 sm:p-4 min-h-[120px] sm:min-h-[158px]" aria-hidden="true">
    <div className="w-[96px] h-[72px] sm:w-[176px] sm:h-[110px] shrink-0 bg-[var(--rule)] opacity-40" />
    <div className="flex-1 flex flex-col gap-2 pt-1">
      <div className="h-3 w-24 bg-[var(--rule)] opacity-40" />
      <div className="h-4 w-4/5 bg-[var(--rule)] opacity-40" />
      <div className="h-3 w-2/5 bg-[var(--rule)] opacity-40" />
    </div>
  </div>
);

const AlsoRead = ({ children }) => (
  <aside className="story-also-read my-10" data-testid="story-also-read">
    <div className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-3">Also read</div>
    <div className="flex flex-col gap-3">{children}</div>
  </aside>
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

  if (!hasLinks) return <div className={className} {...rest} dangerouslySetInnerHTML={{ __html: linksInNewTab(html) }} />;
  return (
    <div className={className} {...rest}>
      {segments.map((s, i) => {
        if (!s.slugs) return <div key={i} dangerouslySetInnerHTML={{ __html: linksInNewTab(s.html) }} />;
        if (!posts) return <AlsoRead key={i}>{s.slugs.map((slug) => <CardPlaceholder key={slug} />)}</AlsoRead>;
        const found = s.slugs.map((slug) => posts[slug]).filter(Boolean);
        if (!found.length) return <div key={i} dangerouslySetInnerHTML={{ __html: linksInNewTab(s.html) }} />;
        return <AlsoRead key={i}>{found.map((p) => <StoryLinkCard key={p.slug} post={p} />)}</AlsoRead>;
      })}
    </div>
  );
};

export default StoryBody;
