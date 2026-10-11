/* The line above a story's headline. It carries two facts: what kind of
   piece it is (its format, set per story in Ghost with an internal tag
   such as #format-analysis, Reportage when none is set) and its topic
   (the story's first public tag). Members' stories are the rule, so only
   free ones are marked. */

const variant = () => {
  try { return localStorage.getItem('tsop_label_variant') || 'a'; } catch (e) { return 'a'; }
};

const freeText = (post) => (post.requires_registration ? 'Free with sign-up' : 'Free to read');

export const StoryLabel = ({ post, className = '' }) => {
  if (!post) return null;
  const v = variant();
  const free = !post.is_premium || post.requires_registration;
  const topic = post.topic && post.topic !== post.format ? post.topic : '';

  if (v === 'b') {
    // Sentence case: format in the reading italic, topic beside it.
    return (
      <p className={`font-plex text-[14px] leading-snug ${className}`} data-testid="story-label">
        <span className="font-reading italic text-[15px] text-[var(--text)]">{post.format}</span>
        {topic && <span className="text-[var(--text-muted)]"> on {topic.toLowerCase()}</span>}
        {free && <span className="text-[var(--accent-ink)] font-medium"> · {freeText(post)}</span>}
      </p>
    );
  }

  if (v === 'c') {
    // A stamp: the format in a solid block, topic in quiet caps.
    return (
      <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 font-plex text-[11px] uppercase tracking-[0.08em] ${className}`} data-testid="story-label">
        <span className="bg-[var(--text)] text-[var(--bg)] font-semibold px-1.5 py-[3px] leading-none">{post.format}</span>
        {topic && <span className="text-[var(--text-label)]">{topic}</span>}
        {free && <span className="text-[var(--accent-ink)] font-semibold">{freeText(post)}</span>}
      </p>
    );
  }

  // a: format in the accent, topic in sentence case, free as an outlined tag.
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-plex ${className}`} data-testid="story-label">
      <span className="text-[12px] uppercase tracking-[0.1em] font-semibold text-[var(--accent-ink)]">{post.format}</span>
      {topic && <span className="text-[14px] text-[var(--text-muted)]">{topic}</span>}
      {free && (
        <span className="self-center text-[11px] font-medium text-[var(--text)] border border-[var(--text)] rounded-full px-2 py-[1px] leading-[1.4]">
          {freeText(post)}
        </span>
      )}
    </p>
  );
};

/* The Left Field is its own publication, not a topic: its name set as a
   name, with the same free mark as a story. */
export const LeftFieldMark = ({ className = '' }) => {
  const v = variant();
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`} data-testid="left-field-mark">
      <span className="font-editorial text-[17px] leading-none text-[var(--text)]">The Left Field</span>
      {v === 'a' ? (
        <span className="self-center font-plex text-[11px] font-medium text-[var(--text)] border border-[var(--text)] rounded-full px-2 py-[1px] leading-[1.4]">Free</span>
      ) : (
        <span className={`font-plex ${v === 'c' ? 'text-[11px] uppercase tracking-[0.08em] font-semibold' : 'text-[14px] font-medium'} text-[var(--accent-ink)]`}>Free</span>
      )}
    </span>
  );
};

export default StoryLabel;
