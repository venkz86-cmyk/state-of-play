import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/* Minimal "↑ TOP" link, no chrome — used in /mockup pages only.
   The live BackToTop component is unchanged.                    */
export const MockupBackToTop = () => {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  // Hidden while the footer is on screen: the button is fixed bottom-right
  // and would otherwise sit on the colophon's "stateofplay.club" line.
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    let observer;
    // Each page renders its own footer, so re-attach on every route change,
    // after the new page has mounted.
    setFooterVisible(false);
    const id = window.setTimeout(() => {
      const footer = document.querySelector('[data-testid="mockup-footer"]');
      if (!footer) return;
      observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
      observer.observe(footer);
    }, 0);
    return () => { window.clearTimeout(id); if (observer) observer.disconnect(); };
  }, [pathname]);

  if (!show || footerVisible) return null;

  return (
    <button
      type="button"
      data-testid="mockup-back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-40 bg-[var(--bg)] border border-[var(--rule)] px-2.5 py-1.5 font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] hover:text-[var(--text)] transition-colors duration-200"
    >
      ↑ Top
    </button>
  );
};

export default MockupBackToTop;
