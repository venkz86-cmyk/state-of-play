import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const API = process.env.REACT_APP_BACKEND_URL;
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
const CONTEXT_MAX = 200;

/**
 * PrintInterceptBlock — only visible when the user prints / saves as PDF.
 *
 * Rendered via a React Portal as a direct sibling of <div id="root">, so the
 * `@media print` CSS can cleanly hide `#root` and show only this block.
 * (If the block lived inside #root we couldn't use `display: none` on #root
 * to hide everything else.)
 *
 * Cross-browser belt-and-braces:
 *   • @media print rules cover Chrome/Edge print preview.
 *   • beforeprint/afterprint listeners toggle html.tsop-printing for Safari
 *     and Firefox, which sometimes don't honour `@media print` on
 *     React-managed trees.
 *   • matchMedia('print') change events as a fallback for Firefox.
 */
export const PrintInterceptBlock = ({
  isPaidSubscriber,
  subscriberName,
  subscriberEmail,
  subscriberGhostId,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const portalNodeRef = useRef(null);

  // Create the portal host node and attach print listeners once.
  if (typeof document !== 'undefined' && !portalNodeRef.current) {
    let node = document.getElementById('tsop-print-portal');
    if (!node) {
      node = document.createElement('div');
      node.id = 'tsop-print-portal';
      document.body.appendChild(node);
    }
    portalNodeRef.current = node;
  }

  useEffect(() => {
    const onBefore = () => document.documentElement.classList.add('tsop-printing');
    const onAfter = () => document.documentElement.classList.remove('tsop-printing');
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    let mql;
    let mqlHandler;
    if (window.matchMedia) {
      mql = window.matchMedia('print');
      mqlHandler = (e) => (e.matches ? onBefore() : onAfter());
      if (mql.addEventListener) mql.addEventListener('change', mqlHandler);
      else if (mql.addListener) mql.addListener(mqlHandler);
    }
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      if (mql && mqlHandler) {
        if (mql.removeEventListener) mql.removeEventListener('change', mqlHandler);
        else if (mql.removeListener) mql.removeListener(mqlHandler);
      }
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedContext = context.trim();
    if (!trimmedName) return setError('Please enter the nominee’s name.');
    if (!isValidEmail(trimmedEmail))
      return setError('Please enter a valid email address.');
    if (!trimmedContext)
      return setError('A line of context helps us reach out well.');
    if (trimmedEmail === (subscriberEmail || '').toLowerCase())
      return setError('You’re already a reader. Try nominating someone else.');

    setSubmitting(true);
    try {
      await fetch(`${API}/api/nominations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_ghost_id: subscriberGhostId || '',
          subscriber_name: subscriberName || '',
          subscriber_email: subscriberEmail || '',
          nominee_name: trimmedName,
          nominee_email: trimmedEmail,
          nominee_context: trimmedContext,
        }),
      });
    } catch (err) {
      // Same fail-open behaviour as NominateReaderBlock.
      console.debug('print-nominate fetch error (suppressed):', err);
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  };

  const node = (
    <>
      {/* Scoped print styles. Inline so they ship with the component. */}
      <style>{`
        /* Screen: this block is hidden, the regular article shows. */
        .tsop-print-only { display: none; }

        /* When the user invokes Print, hide the entire SPA and show this block.
           We hide #root (where React mounts) — this block is portaled OUTSIDE
           of #root, so the rule cleanly hides everything else. */
        @media print {
          @page { margin: 0; size: A4; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #FAF9F7 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #root { display: none !important; }
          .tsop-print-only { display: flex !important; }
        }
        /* JS-driven class for Safari / Firefox that don't honour @media print
           reliably for React-managed trees. Same rules, higher specificity. */
        html.tsop-printing #root { display: none !important; }
        html.tsop-printing .tsop-print-only { display: flex !important; }

        .tsop-print-only {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #FAF9F7;
          color: #1A1A1A;
          padding: 64px 48px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
          page-break-inside: avoid;
        }
        .tsop-print-only__mast {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #888;
          margin: 0 0 48px;
        }
        .tsop-print-only__hed {
          font-family: 'Fraunces', Georgia, serif;
          font-weight: 600;
          font-size: 44px;
          line-height: 1.1;
          letter-spacing: -0.012em;
          margin: 0 0 18px;
          max-width: 22ch;
        }
        .tsop-print-only__sub {
          font-family: 'Newsreader', Georgia, serif;
          font-style: italic;
          font-size: 22px;
          line-height: 1.45;
          color: #555;
          margin: 0 0 40px;
          max-width: 36ch;
        }
        .tsop-print-only__form {
          width: 100%;
          max-width: 460px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin: 0 0 32px;
        }
        .tsop-print-only__input,
        .tsop-print-only__textarea {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 15px;
          padding: 12px 14px;
          border: 1px solid #1A1A1A;
          background: transparent;
          color: #1A1A1A;
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .tsop-print-only__textarea {
          min-height: 80px;
          resize: vertical;
          font-family: 'Newsreader', Georgia, serif;
          font-size: 16px;
          line-height: 1.5;
        }
        .tsop-print-only__count {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 11px;
          color: #888;
          text-align: right;
          margin: -6px 0 0;
        }
        .tsop-print-only__err {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px;
          color: #A0291C;
          margin: 0;
        }
        .tsop-print-only__cta {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: #A0291C;
          color: #fff;
          border: 0;
          padding: 14px 32px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .tsop-print-only__cta:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .tsop-print-only__footnote {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #444;
          margin: 28px 0 0;
          max-width: 36ch;
        }
        .tsop-print-only__url {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #888;
          margin: 56px 0 0;
        }
        @media (max-width: 600px) {
          .tsop-print-only__hed { font-size: 32px; }
          .tsop-print-only__sub { font-size: 18px; }
        }
      `}</style>

      <aside
        className="tsop-print-only"
        role="region"
        aria-label="Print intercept — please nominate instead"
        data-testid="print-intercept-block"
      >
        <p className="tsop-print-only__mast">— The State of Play —</p>

        <h2 className="tsop-print-only__hed">
          This piece doesn’t travel well as a&nbsp;PDF.
        </h2>

        {isPaidSubscriber ? (
          submitted ? (
            <>
              <p className="tsop-print-only__sub">
                Sent. {name || 'Your nominee'} will receive the full story
                shortly — straight from us.
              </p>
              <p className="tsop-print-only__footnote">
                Cancel the print dialog and come back to keep reading.
              </p>
            </>
          ) : (
            <>
              <p className="tsop-print-only__sub">
                There’s a better way to share it.
              </p>
              <form
                className="tsop-print-only__form"
                onSubmit={onSubmit}
                data-testid="print-nominate-form"
              >
                <input
                  type="text"
                  className="tsop-print-only__input"
                  placeholder="Their name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  data-testid="print-nominee-name"
                />
                <input
                  type="email"
                  className="tsop-print-only__input"
                  placeholder="Their email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  data-testid="print-nominee-email"
                />
                <textarea
                  className="tsop-print-only__textarea"
                  placeholder="Why should they read this?"
                  value={context}
                  onChange={(e) =>
                    setContext(e.target.value.slice(0, CONTEXT_MAX))
                  }
                  disabled={submitting}
                  maxLength={CONTEXT_MAX}
                  data-testid="print-nominee-context"
                />
                <p className="tsop-print-only__count">
                  {context.length} / {CONTEXT_MAX}
                </p>
                {error && (
                  <p
                    className="tsop-print-only__err"
                    data-testid="print-nominate-error"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="tsop-print-only__cta"
                  disabled={submitting}
                  data-testid="print-nominate-submit"
                >
                  {submitting ? 'Sending…' : 'Nominate them →'}
                </button>
              </form>
              <p className="tsop-print-only__footnote">
                We’ll send them the full story directly. No paywall. No pitch.
                Just the reporting.
              </p>
            </>
          )
        ) : (
          <>
            <p className="tsop-print-only__sub">
              The people who should be reading it are already at
              stateofplay.club.
            </p>
            <a
              href="https://www.stateofplay.club"
              className="tsop-print-only__cta"
              data-testid="print-cta-subscribe"
            >
              Subscribe &rarr;
            </a>
          </>
        )}

        <p className="tsop-print-only__url">stateofplay.club</p>
      </aside>
    </>
  );

  // Portal out of #root so the CSS rule `#root { display: none }` doesn't
  // accidentally hide this block too. Falls back to inline render during
  // SSR / first paint before the portal node attaches.
  if (portalNodeRef.current) {
    return createPortal(node, portalNodeRef.current);
  }
  return node;
};

export default PrintInterceptBlock;
