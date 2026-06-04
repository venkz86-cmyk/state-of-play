import { useEffect, useState } from 'react';

/* Thin reading-progress bar — burgundy, 2px desktop / 3px mobile,
   fixed top of viewport, fades out as the reader hits the end.    */
export const ReadingProgress = ({ targetSelector = '[data-testid="article-body"]' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calc = () => {
      const el = document.querySelector(targetSelector);
      if (!el) {
        setProgress(0);
        return;
      }
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height;
      // start when top hits viewport, end when bottom leaves
      const scrolled = Math.max(0, viewport - rect.top);
      const pct = Math.min(100, Math.max(0, (scrolled / (total + viewport - 100)) * 100));
      setProgress(pct);
    };
    calc();
    window.addEventListener('scroll', calc, { passive: true });
    window.addEventListener('resize', calc);
    return () => {
      window.removeEventListener('scroll', calc);
      window.removeEventListener('resize', calc);
    };
  }, [targetSelector]);

  // hide once reader has cleared the article
  const visible = progress > 0 && progress < 99.5;

  return (
    <div
      data-testid="reading-progress"
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[60] pointer-events-none transition-opacity duration-200"
      style={{ height: '3px', opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-[var(--accent-burgundy)] origin-left"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default ReadingProgress;
