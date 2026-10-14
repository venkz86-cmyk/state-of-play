import { useEffect, useRef, useState } from 'react';
import { isBookmarked, toggleBookmark } from './Bookmarks';

/* The bar at the bottom of a story in the home-screen app, in place of the
   tab bar (ArticleMockup marks <html class="story-mode"> while a story is
   open). What a reader does in a story: change the text size, save it,
   share it, and for members, gift it. Icons are drawn like the tab bar's,
   in the logo's square line. Like the tab bar, it slides away while
   reading down and comes back on any scroll up. */
const SIZES = [['small', 'Small', 15], ['default', 'Default', 18], ['large', 'Large', 22]];

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'square', strokeLinejoin: 'miter' };

const Icon = ({ name, on }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="block">
    {name === 'save' && <path d="M6 3.5H18V20.5L12 16L6 20.5Z" {...stroke} fill={on ? 'currentColor' : 'none'} />}
    {name === 'share' && (
      <>
        <path d="M12 3.5V14.5" {...stroke} />
        <path d="M8 7.5L12 3.5L16 7.5" {...stroke} />
        <path d="M8.5 10.5H5V20.5H19V10.5H15.5" {...stroke} />
      </>
    )}
    {name === 'gift' && (
      <>
        <rect x="3.5" y="8.5" width="17" height="4" {...stroke} />
        <path d="M5 12.5V20.5H19V12.5" {...stroke} />
        <path d="M12 8.5V20.5" {...stroke} />
        <path d="M12 8.5C10 8.5 7.5 7.5 7.5 5.5C7.5 4 9 3.5 10 4.2C11 4.9 12 6.5 12 8.5Z" {...stroke} />
        <path d="M12 8.5C14 8.5 16.5 7.5 16.5 5.5C16.5 4 15 3.5 14 4.2C13 4.9 12 6.5 12 8.5Z" {...stroke} />
      </>
    )}
  </svg>
);

export const StoryBar = ({ article, size, onSize, hasAmounts, showDollars, onDollars, onGift }) => {
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const lastY = useRef(0);

  useEffect(() => { setSaved(isBookmarked(article?.id)); }, [article?.id]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
      if (y < 80 || nearBottom || y < lastY.current - 6) setHidden(false);
      else if (y > lastY.current + 6) { setHidden(true); setSheet(false); }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const flash = (text) => { setNote(text); setTimeout(() => setNote(''), 1800); };
  const save = () => {
    const now = toggleBookmark(article);
    setSaved(now);
    flash(now ? 'Saved to You' : 'Removed from saved');
  };
  const share = async () => {
    const url = `https://www.stateofplay.club/${article.slug || article.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: article.title, url }); return; }
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch (e) { /* share sheet closed */ }
  };

  const btn = 'flex-1 flex flex-col items-center justify-center gap-[5px] h-[58px] text-[var(--text-muted)] app-tab';
  const lbl = 'whitespace-nowrap text-[11px] leading-none tracking-[0.02em] font-medium';

  return (
    <nav
      aria-label="Story"
      data-testid="story-bar"
      className={`app-tab-bar story-bar fixed inset-x-0 bottom-0 z-50 border-t border-[var(--rule)] backdrop-blur-xl transition-transform duration-200 ${hidden ? 'translate-y-full' : ''}`}
    >
      {sheet && (
        <div className="absolute inset-x-0 bottom-full border-t border-[var(--rule)] bg-[var(--nav-bg)] px-6 pt-5 pb-6" data-testid="story-text-sheet">
          <div className="max-w-[560px] mx-auto">
            <p className="font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)] mb-3">Text size</p>
            <div className="grid grid-cols-3 border border-[var(--rule)]" role="radiogroup" aria-label="Text size">
              {SIZES.map(([key, name, px], i) => (
                <button key={key} type="button" role="radio" aria-checked={size === key} onClick={() => onSize(key)}
                  data-testid={`story-size-${key}`}
                  className={`h-14 flex flex-col items-center justify-center gap-1 ${i ? 'border-l border-[var(--rule)]' : ''} ${size === key ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text)]'}`}>
                  <span className="font-editorial leading-none" style={{ fontSize: px }}>A</span>
                  <span className="font-plex text-[11px]">{name}</span>
                </button>
              ))}
            </div>
            {hasAmounts && (
              <label className="flex items-center justify-between gap-6 mt-5 cursor-pointer">
                <span className="font-plex text-[15px]">Show US dollars</span>
                <input type="checkbox" role="switch" className="sr-only peer" checked={showDollars} onChange={(e) => onDollars(e.target.checked)} data-testid="story-dollars" />
                <span aria-hidden="true"
                  className="relative shrink-0 h-7 w-12 rounded-full bg-[var(--rule)] peer-checked:bg-[var(--accent-blue)] transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:h-[22px] after:w-[22px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
              </label>
            )}
          </div>
        </div>
      )}
      {note && !hidden && (
        <p role="status" className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 bg-[var(--text)] text-[var(--bg)] font-plex text-[13px] px-3 py-1.5 whitespace-nowrap" data-testid="story-bar-note">
          {note}
        </p>
      )}
      <div className="flex max-w-[560px] mx-auto px-1">
        <button type="button" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} data-testid="story-aa"
          className={`${btn} ${sheet ? '!text-[var(--accent-blue)]' : ''}`}>
          <span className="block h-6 font-editorial text-[21px] leading-6" aria-hidden="true">Aa</span>
          <span className={lbl}>Text</span>
        </button>
        <button type="button" onClick={save} aria-pressed={saved} data-testid="story-save" className={`${btn} ${saved ? '!text-[var(--accent-blue)]' : ''}`}>
          <Icon name="save" on={saved} />
          <span className={lbl}>{saved ? 'Saved' : 'Save'}</span>
        </button>
        <button type="button" onClick={share} data-testid="story-share" className={btn}>
          <Icon name="share" />
          <span className={lbl}>Share</span>
        </button>
        {onGift && (
          <button type="button" onClick={onGift} data-testid="story-gift" className={btn}>
            <Icon name="gift" />
            <span className={lbl}>Gift</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default StoryBar;
