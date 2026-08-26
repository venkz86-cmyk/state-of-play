import { useEffect, useState } from 'react';

const SIZES = ['small', 'default', 'large'];
const KEY = 'tsop_mockup_article_size';

// Persisted Small / Default / Large selector for the mockup article page.
// Reads/writes to localStorage so the choice survives page navigation.
export const useArticleSize = () => {
  const [size, setSize] = useState('default');
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v && SIZES.includes(v)) setSize(v);
    } catch { /* ignore */ }
  }, []);
  const update = (v) => {
    setSize(v);
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  };
  return [size, update];
};

export const MockupFontSizeToggle = ({ value, onChange }) => {
  const index = Math.max(0, SIZES.indexOf(value));
  const fill = `${(index / (SIZES.length - 1)) * 100}%`;

  return (
    <div
      data-testid="font-size-toggle"
      className="inline-flex items-center gap-3 font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)]"
    >
      <span>Text size</span>
      <span className="font-editorial normal-case text-[12px] text-[var(--text-muted)]" aria-hidden="true">A</span>
      <input
        type="range"
        min={0}
        max={SIZES.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(SIZES[Number(e.target.value)])}
        data-testid="font-size-slider"
        aria-label="Text size"
        className="tsop-size-slider"
        style={{ '--tsop-slider-fill': fill }}
      />
      <span className="font-editorial normal-case text-[19px] text-[var(--text-muted)]" aria-hidden="true">A</span>
    </div>
  );
};

export default MockupFontSizeToggle;
