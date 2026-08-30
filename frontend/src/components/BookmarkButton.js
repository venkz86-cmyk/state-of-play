import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { isBookmarked, toggleBookmark } from './Bookmarks';

// Matches ShareRow's text treatment so the two sit naturally side by side
// in the article utility strip.
export const BookmarkButton = ({ article }) => {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isBookmarked(article?.id));
  }, [article?.id]);

  if (!article?.id) return null;

  const handleClick = () => {
    setSaved(toggleBookmark(article));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="bookmark-toggle"
      title={saved ? 'Remove from saved' : 'Save for later'}
      aria-label={saved ? 'Remove from saved' : 'Save for later'}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 font-plex text-[12px] uppercase tracking-[0.08em] transition-colors duration-200 ${
        saved ? 'text-[var(--accent-burgundy)]' : 'text-[var(--text-label)] hover:text-[var(--text)]'
      }`}
    >
      <Bookmark
        className="w-[15px] h-[15px]"
        strokeWidth={1.5}
        fill={saved ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
};

export default BookmarkButton;
