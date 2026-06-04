import { useEffect, useState } from 'react';

const SIZES = [
  { id: 'small', label: 'S' },
  { id: 'default', label: 'M' },
  { id: 'large', label: 'L' },
];

const KEY = 'tsop_mockup_article_size';

// Persisted Small / Default / Large selector for the mockup article page.
// Reads/writes to localStorage so the choice survives page navigation.
export const useArticleSize = () => {
  const [size, setSize] = useState('default');
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v && ['small', 'default', 'large'].includes(v)) setSize(v);
    } catch { /* ignore */ }
  }, []);
  const update = (v) => {
    setSize(v);
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  };
  return [size, update];
};

export const MockupFontSizeToggle = ({ value, onChange }) => (
  <div
    data-testid="font-size-toggle"
    className="inline-flex items-center font-plex text-[11px] uppercase tracking-[0.08em]"
  >
    <span className="text-[var(--text-label)] mr-3">Text</span>
    {SIZES.map((s, i) => (
      <span key={s.id} className="inline-flex items-center">
        <button
          type="button"
          onClick={() => onChange(s.id)}
          data-testid={`font-size-${s.id}`}
          aria-pressed={value === s.id}
          className={`px-1.5 transition-colors duration-200 ${
            value === s.id
              ? 'text-[var(--text)]'
              : 'text-[#999999] hover:text-[var(--text)]'
          }`}
        >
          {s.label}
        </button>
        {i < SIZES.length - 1 && (
          <span className="text-[var(--rule)] mx-0.5" aria-hidden="true">|</span>
        )}
      </span>
    ))}
  </div>
);

export default MockupFontSizeToggle;
