import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'tsop_reading_pos_';
const MIN_SCROLL_TO_OFFER = 500; // px — ignore barely-scrolled visits
const FINISHED_THRESHOLD_PX = 400; // how close to the bottom counts as "finished"

/* Quiet, dismissible "continue where you left off" nudge for long
   articles. Never auto-scrolls — the reader always lands at the top on
   open, exactly as normal; this only offers a way to jump back in if
   they choose to. Saves scroll position continuously while reading
   (clearing it once they've effectively finished the piece), and offers
   to resume on a later visit if there's a meaningful saved position. */
export const ContinueReading = ({ articleId }) => {
  const [savedY, setSavedY] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `${STORAGE_PREFIX}${articleId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const y = raw ? parseInt(raw, 10) : 0;
      if (y > MIN_SCROLL_TO_OFFER) setSavedY(y);
    } catch (e) { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    let raf = null;
    const save = () => {
      raf = null;
      try {
        const nearBottom =
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - FINISHED_THRESHOLD_PX;
        if (nearBottom) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, String(window.scrollY));
        }
      } catch (e) { /* ignore */ }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(save);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', save);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', save);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [storageKey]);

  if (!savedY || dismissed) return null;

  return (
    <div
      data-testid="continue-reading-nudge"
      className="flex items-center justify-between gap-4 mb-8 py-3 px-4 border border-[var(--rule)]"
      style={{ borderRadius: 'var(--control-radius, 4px)' }}
    >
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: savedY, behavior: 'smooth' });
          setDismissed(true);
        }}
        data-testid="continue-reading-cta"
        className="font-plex text-[13px] text-[var(--accent-burgundy)] underline underline-offset-[4px] decoration-1 hover:decoration-2 transition-all text-left"
      >
        Continue where you left off
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        data-testid="continue-reading-dismiss"
        className="font-plex text-[13px] text-[var(--text-label)] hover:text-[var(--text)] transition-colors shrink-0"
      >
        ×
      </button>
    </div>
  );
};

export default ContinueReading;
