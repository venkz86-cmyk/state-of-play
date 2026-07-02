import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useNominate } from '../hooks/useNominate';

/**
 * PrintInterceptBlock — only visible when the user prints / saves as PDF.
 *
 * Rendered via a React Portal as a direct sibling of <div id="root">, so the
 * `@media print` CSS can cleanly hide `#root` and show only this block.
 *
 * Two variants:
 *   • isPaidSubscriber=true  → nominate form (real <input>/<textarea>
 *     elements — Chrome/Safari/Firefox print dialogs render them with
 *     visible borders). Shares state + validation with NominateReaderBlock
 *     via the useNominate() hook.
 *   • isPaidSubscriber=false → simpler "this piece doesn't travel well"
 *     block with a CTA pointing back to stateofplay.club.
 *
 * Physical printout fallback: since a printed page can't run JS, we render
 * a QR code + a plainly-typed short URL under the form. Whoever ends up
 * with the printout can scan or type the URL to reach the site.
 *
 * Cross-browser belt-and-braces:
 *   • @media print rule + `#root { display: none }` (Chrome / Edge).
 *   • beforeprint / afterprint listeners toggle html.tsop-printing for
 *     Safari and Firefox which sometimes miss @media print on React trees.
 *   • matchMedia('print') change events for Firefox older builds.
 */
export const PrintInterceptBlock = ({
  isPaidSubscriber,
  subscriberName,
  subscriberEmail,
  subscriberGhostId,
  articleSlug,
}) => {
  const portalNodeRef = useRef(null);

  const {
    name, email, context, submitting, submitted, error,
    setName, setEmail, setContext, handleSubmit, clearBlock,
    quota, blocked, resetsOn, CONTEXT_MAX,
  } = useNominate({ subscriberName, subscriberEmail, subscriberGhostId });

  // Create portal host node once. Lives outside #root so the CSS rule
  // `#root { display: none }` doesn't hide us.
  if (typeof document !== 'undefined' && !portalNodeRef.current) {
    let node = document.getElementById('tsop-print-portal');
    if (!node) {
      node = document.createElement('div');
      node.id = 'tsop-print-portal';
      document.body.appendChild(node);
    }
    portalNodeRef.current = node;
  }

  // Toggle `html.tsop-printing` on print events for browsers whose @media
  // print rule doesn't apply cleanly to portaled trees (Safari, Firefox).
  useEffect(() => {
    const onBefore = () => document.documentElement.classList.add('tsop-printing');
    const onAfter = () => document.documentElement.classList.remove('tsop-printing');
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    let mql; let mqlHandler;
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

  // The URL a physical printout points to. If we know the article, deep-link
  // there with a ?ref=print attribution query. Otherwise site root.
  const printableUrl = articleSlug
    ? `https://www.stateofplay.club/${articleSlug}?ref=print`
    : 'https://www.stateofplay.club';

  const node = (
    <>
      <style>{`
        /* Screen: block hidden by default. */
        .tsop-print-only { display: none; }

        /* Print (Chrome/Edge). Hide the entire SPA (#root) and show us. */
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
          /* Form fields keep visible borders on the printed page — some
             browsers otherwise strip input borders in print mode. */
          .tsop-print-only__input,
          .tsop-print-only__textarea {
            border: 1px solid #1A1A1A !important;
            background: #ffffff !important;
            color: #1A1A1A !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .tsop-print-only__cta {
            background: #A0291C !important;
            color: #ffffff !important;
            border: 1px solid #A0291C !important;
          }
        }
        /* JS-driven for Safari / Firefox. Higher specificity, same effect. */
        html.tsop-printing #root { display: none !important; }
        html.tsop-printing .tsop-print-only { display: flex !important; }

        .tsop-print-only {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #FAF9F7;
          color: #1A1A1A;
          padding: 56px 40px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
          page-break-inside: avoid;
        }
        .tsop-print-only__mast {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #888; margin: 0 0 12px;
        }
        .tsop-print-only__quota {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #A0291C; margin: 0 0 32px;
        }
        .tsop-print-only__hed {
          font-family: 'Fraunces', Georgia, serif;
          font-weight: 600; font-size: 40px; line-height: 1.1;
          letter-spacing: -0.012em;
          margin: 0 0 14px; max-width: 22ch;
        }
        .tsop-print-only__sub {
          font-family: 'Newsreader', Georgia, serif;
          font-style: italic; font-size: 20px; line-height: 1.45;
          color: #555; margin: 0 0 32px; max-width: 36ch;
        }
        .tsop-print-only__form {
          width: 100%; max-width: 460px;
          display: flex; flex-direction: column; gap: 12px;
          margin: 0 0 24px;
        }
        .tsop-print-only__input,
        .tsop-print-only__textarea {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 15px; padding: 12px 14px;
          border: 1px solid #1A1A1A;
          background: #ffffff; color: #1A1A1A;
          outline: none; width: 100%; box-sizing: border-box;
          border-radius: 0;
        }
        .tsop-print-only__textarea {
          min-height: 76px; resize: vertical;
          font-family: 'Newsreader', Georgia, serif;
          font-size: 16px; line-height: 1.5;
        }
        .tsop-print-only__count {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 11px; color: #888; text-align: right; margin: -6px 0 0;
        }
        .tsop-print-only__err {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px; color: #A0291C; margin: 0;
        }
        .tsop-print-only__cta {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          background: #A0291C; color: #fff; border: 0;
          padding: 14px 32px; cursor: pointer;
          text-decoration: none; display: inline-block;
        }
        .tsop-print-only__cta:disabled { opacity: .55; cursor: not-allowed; }
        .tsop-print-only__footnote {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px; line-height: 1.55;
          color: #444; margin: 20px 0 0; max-width: 36ch;
        }

        /* ── Print-only fallback: QR + printable URL ── */
        .tsop-print-only__fallback {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; margin: 40px 0 0;
          padding: 24px 0 0;
          border-top: 1px solid #DDD8CE;
          width: 100%; max-width: 460px;
        }
        .tsop-print-only__fallback-label {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: #999;
        }
        .tsop-print-only__qr {
          background: #ffffff; padding: 8px;
          border: 1px solid #E5E2DC;
        }
        .tsop-print-only__printurl {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 13px; color: #1A1A1A;
          word-break: break-all;
          max-width: 40ch;
        }
        .tsop-print-only__printurl strong {
          font-weight: 500;
          border-bottom: 1px solid #1A1A1A;
        }

        .tsop-print-only__url {
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 12px; letter-spacing: 0.08em;
          text-transform: uppercase; color: #888;
          margin: 40px 0 0;
        }

        @media (max-width: 600px) {
          .tsop-print-only__hed { font-size: 30px; }
          .tsop-print-only__sub { font-size: 17px; }
        }
      `}</style>

      <aside
        className="tsop-print-only"
        role="region"
        aria-label="Print intercept — nominate a reader instead"
        data-testid="print-intercept-block"
      >
        <p className="tsop-print-only__mast">— The State of Play —</p>

        {isPaidSubscriber && quota && typeof quota.remaining === 'number' && !blocked && !submitted && (
          <p
            className="tsop-print-only__quota"
            data-testid="print-quota-label"
          >
            {quota.remaining} of {quota.quota} nominations remaining this month
          </p>
        )}

        <h2 className="tsop-print-only__hed">
          This piece doesn’t travel well as a&nbsp;PDF.
        </h2>

        {isPaidSubscriber ? (
          blocked === 'quota' ? (
            <div data-testid="print-blocked-quota">
              <p className="tsop-print-only__sub">
                You’ve used all 5 nominations this month.
              </p>
              <p className="tsop-print-only__footnote">
                Your quota resets on {resetsOn || 'the 1st of next month'}.
              </p>
            </div>
          ) : blocked === 'duplicate' ? (
            <div data-testid="print-blocked-duplicate">
              <p className="tsop-print-only__sub">
                You’ve already nominated this person twice. Time to let them decide.
              </p>
              <button
                type="button"
                onClick={clearBlock}
                className="tsop-print-only__cta"
                data-testid="print-blocked-duplicate-try-another"
              >
                Nominate someone else →
              </button>
            </div>
          ) : submitted ? (
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
                onSubmit={handleSubmit}
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
                  onChange={(e) => setContext(e.target.value)}
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

        {/* ── Printout fallback: QR + short URL ── */}
        <div
          className="tsop-print-only__fallback"
          data-testid="print-fallback-block"
        >
          <span className="tsop-print-only__fallback-label">
            Or scan / type
          </span>
          <div className="tsop-print-only__qr">
            <QRCodeSVG
              value={printableUrl}
              size={104}
              level="M"
              bgColor="#ffffff"
              fgColor="#1A1A1A"
              includeMargin={false}
              data-testid="print-qr"
            />
          </div>
          <p
            className="tsop-print-only__printurl"
            data-testid="print-url-fallback"
          >
            <strong>{printableUrl.replace(/^https?:\/\//, '')}</strong>
          </p>
        </div>

        <p className="tsop-print-only__url">stateofplay.club</p>
      </aside>
    </>
  );

  if (portalNodeRef.current) {
    return createPortal(node, portalNodeRef.current);
  }
  return node;
};

export default PrintInterceptBlock;
