import { useEffect, useState } from 'react';

// "Show US dollars" on a story, for readers outside India
// (ArticleMockup). Off by default, so the story reads exactly as
// written; turning it on adds a rounded dollar figure after each rupee
// amount (lib/currency.js). The choice is remembered in this browser.
const KEY = 'tsop_show_usd';

export const useShowDollars = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(window.localStorage.getItem(KEY) === '1'); } catch (_e) { /* storage blocked: stays off */ }
  }, []);
  const set = (value) => {
    setOn(value);
    try { window.localStorage.setItem(KEY, value ? '1' : '0'); } catch (_e) { /* not remembered */ }
  };
  return [on, set];
};

export const DollarToggle = ({ on, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    data-testid="dollar-toggle"
    className="inline-flex items-center gap-2.5 font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)] hover:text-[var(--text)]"
  >
    <span>Show US dollars</span>
    <span
      aria-hidden="true"
      className={`relative inline-block w-8 h-[18px] border transition-colors ${
        on ? 'bg-[var(--accent-burgundy)] border-[var(--accent-burgundy)]' : 'bg-transparent border-[var(--text-label)]'
      }`}
    >
      <span
        className={`absolute top-[2px] w-3 h-3 transition-all ${on ? 'left-[16px] bg-white' : 'left-[2px] bg-[var(--text-label)]'}`}
      />
    </span>
  </button>
);

export default DollarToggle;
