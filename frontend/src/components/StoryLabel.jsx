/* The indicator above a story's headline: what kind of piece it is, and
   a mark on free stories. The format is set per story in Ghost with an
   internal tag such as #format-analysis (Reportage when none is set).
   Members' stories are the rule, so only free ones are marked. Topics
   are tags for the archive, not part of this line. */

const freeText = (post) => (post.requires_registration ? 'Free with sign-up' : 'Free to read');

export const FreeMark = ({ children = 'Free', className = '' }) => (
  <span className={`inline-block font-plex text-[11px] font-medium text-[var(--text)] border border-[var(--text)] rounded-full px-2 py-[1px] leading-[1.4] ${className}`}>
    {children}
  </span>
);

export const StoryLabel = ({ post, small = false, showFree = true, as: Tag = 'p', className = '' }) => {
  if (!post) return null;
  const free = showFree && (!post.is_premium || post.requires_registration);
  return (
    <Tag className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 font-plex ${className}`} data-testid="story-label">
      <span className={`${small ? 'text-[11px]' : 'text-[12px]'} uppercase tracking-[0.1em] font-semibold text-[var(--accent-ink)]`}>
        {post.format || 'Reportage'}
      </span>
      {free && <FreeMark>{freeText(post)}</FreeMark>}
    </Tag>
  );
};

/* The Left Field is its own publication: its name set as a name, with
   the same free mark as a story. */
export const LeftFieldMark = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-2 ${className}`} data-testid="left-field-mark">
    <span className="font-editorial text-[17px] leading-none text-[var(--text)]">The Left Field</span>
    <FreeMark />
  </span>
);

export default StoryLabel;
