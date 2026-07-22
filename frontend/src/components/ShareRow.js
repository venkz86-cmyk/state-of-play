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

// Flat, no icons, Geist 12px uppercase. Hover: text → primary.
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
      /* clipboard blocked — silent */
    }
  };

  return (
    <div
      data-testid="share-row"
      className="flex flex-wrap items-center gap-x-2 gap-y-2 font-plex text-[12px] uppercase tracking-[0.08em]"
    >
      <span className="text-[var(--text-label)] mr-2">Share</span>
      {PLATFORMS.map((k, i) => {
        const isLastPlatform = i === PLATFORMS.length - 1;
        const showSeparatorAfter = !isLastPlatform || !!onGiftClick;
        const common =
          'inline-flex items-center text-[var(--text-label)] hover:text-[var(--text)] transition-colors duration-200';
        return (
          <span key={k} className="inline-flex items-center">
            {k === 'copy' ? (
              <button
                type="button"
                onClick={onCopy}
                data-testid="share-copy"
                className={common}
              >
                {copied ? 'Copied' : labelFor(k)}
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
            {showSeparatorAfter && <span className="mx-2 text-[var(--text-label)]">·</span>}
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
          className="inline-flex items-center text-[var(--text-label)] hover:text-[var(--accent-burgundy)] transition-colors duration-200"
        >
          <Gift className="w-[15px] h-[15px]" strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default ShareRow;
