import { useState, useEffect } from 'react';

const DISMISS_KEY = 'tsop_survey_2026_dismissed';
const SURVEY_URL = 'https://tally.so/r/q4lD1Y';

// A single, thin, dismissible strip -- deliberately not a modal, not a
// filled color block, nothing that interrupts the page. Sits above the
// dateline, blends with the page background, and remembers a dismissal
// per browser (localStorage, per-viewer convenience only -- never read
// back or relied on server-side, same trust level as every other
// localStorage use in this codebase).
export const SurveyBanner = () => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch (_e) {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch (_e) {
      /* private-mode/storage-blocked -- just won't be remembered */
    }
  };

  if (dismissed) return null;

  return (
    <div data-testid="survey-banner" className="border-b border-[var(--rule)]">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 py-2.5 flex items-center justify-between gap-4">
        <p className="font-plex text-[13px] text-[var(--text-muted)] leading-relaxed">
          <span className="text-[var(--text)] font-medium">The State of Play Annual Survey.</span>{' '}
          Five minutes, subscribers only —{' '}
          <a
            href={SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-burgundy)] underline underline-offset-4 hover:decoration-2"
          >
            take the survey
          </a>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 font-plex text-[18px] leading-none text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default SurveyBanner;
