import { useEffect, useState } from 'react';

/* Minimal "↑ TOP" link, no chrome — used in /mockup pages only.
   The live BackToTop component is unchanged.                    */
export const MockupBackToTop = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      data-testid="mockup-back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-40 font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] hover:text-[var(--text)] transition-colors duration-200"
    >
      ↑ Top
    </button>
  );
};

export default MockupBackToTop;
