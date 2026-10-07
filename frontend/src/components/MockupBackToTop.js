import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/* Minimal "↑ TOP" link, no chrome — used in /mockup pages only.
   The live BackToTop component is unchanged.                    */
export const MockupBackToTop = () => {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  // Hidden while the footer is on screen: the button is fixed bottom-right
  // and would otherwise sit on the colophon's "stateofplay.club" line.
  // Checked on every scroll rather than with an observer attached once,
  // because some pages (the homepage) render their footer only after
  // their stories load, so it isn't there yet when the route changes.
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      setShow(window.scrollY > 600);
      const footer = document.querySelector('[data-testid="mockup-footer"]');
      setFooterVisible(!!footer && footer.getBoundingClientRect().top < window.innerHeight);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
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
