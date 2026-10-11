import { useState } from 'react';
import { Gift } from 'lucide-react';

const PLATFORMS = ['x', 'linkedin', 'whatsapp', 'copy'];

const labelFor = (k) =>
  ({ x: 'X', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', copy: 'Copy link' }[k]);

const hrefFor = (k, { url, title }) => {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  if (k === 'x') return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
  if (k === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  if (k === 'whatsapp') return `https://wa.me/?text=${t}%20${u}`;
  return null;
};

// Flat, no icons, Schibsted Grotesk 12px uppercase. Hover: text → primary.
// The Gift icon is the one deliberate exception — it's the only affordance
// that opens a modal (not a share URL), so we lean on iconography +
// tooltip to signal a different interaction class.
export const ShareRow = ({ title = '', url, onGiftClick }) => {
  const [copied, setCopied] = useState(false);
  const pageUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (some in-app browsers): show the link to copy by hand.
      window.prompt('Copy this link:', pageUrl);
    }
  };

  // Phones get their own share sheet (WhatsApp, Messages, Mail and the
  // rest) from the "Share" label itself. Desktop browsers that also offer
  // navigator.share keep the plain label: the links beside it are clearer there.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    && typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const onShare = async () => {
    try { await navigator.share({ title, url: pageUrl }); } catch { /* dismissed */ }
  };

  return (
    <div
      data-testid="share-row"
      className="flex flex-wrap items-center gap-x-2 gap-y-2 font-plex text-[12px] uppercase tracking-[0.05em] sm:tracking-[0.08em]"
    >
      {canShare ? (
        <button type="button" onClick={onShare} data-testid="share-native"
          className="inline-flex items-center uppercase tracking-[0.05em] text-[var(--text)] underline underline-offset-4 decoration-[var(--rule)] py-2 mr-1">
          Share
        </button>
      ) : (
        <span className="text-[var(--text-label)] mr-1 sm:mr-2">Share</span>
      )}
      {PLATFORMS.map((k, i) => {
        const isLastPlatform = i === PLATFORMS.length - 1;
        const showSeparatorAfter = !isLastPlatform || !!onGiftClick;
        const common =
          // uppercase/tracking repeated here: Tailwind's preflight resets
          // text-transform on <button>, so "Copy link" otherwise breaks case.
          'inline-flex items-center py-2 uppercase tracking-[0.05em] sm:tracking-[0.08em] text-[var(--text-label)] hover:text-[var(--text)] transition-colors duration-200';
        return (
          <span key={k} className="inline-flex items-center">
            {k === 'copy' ? (
              <button
                type="button"
                onClick={onCopy}
                data-testid="share-copy"
                className={common}
              >
                {copied ? 'Copied' : (
                  <>
                    {/* "Copy" on phones keeps the whole row on one line */}
                    <span className="sm:hidden">Copy</span>
                    <span className="hidden sm:inline">{labelFor(k)}</span>
                  </>
                )}
              </button>
            ) : (
              <a
                href={hrefFor(k, { url: pageUrl, title })}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`share-${k}`}
                className={common}
              >
                {labelFor(k)}
              </a>
            )}
            {showSeparatorAfter && <span className="mx-1.5 sm:mx-2 text-[var(--text-label)]">·</span>}
          </span>
        );
      })}
      {onGiftClick && (
        <button
          type="button"
          onClick={onGiftClick}
          title="Gift this article."
          aria-label="Gift this article"
          data-testid="share-gift"
          className="inline-flex items-center p-2 -m-2 text-[var(--text-label)] hover:text-[var(--accent-ink)] transition-colors duration-200"
        >
          <Gift className="w-[15px] h-[15px]" strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default ShareRow;
