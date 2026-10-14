import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { track } from '../lib/analytics';

/* The app's Share sheet, for stories and Left Field editions. Each place
   gets what shows best there: WhatsApp gets the headline in bold over the
   link (WhatsApp draws the preview card from the link), X gets the headline
   and @stateofplayclub, LinkedIn just the link (it builds its own card),
   and Instagram, which takes no links, gets a tall card made for Stories
   (/api/og-image/<slug>?format=story) with the link copied for a link
   sticker. The card the link will show sits at the top, so a reader sees
   what the other person gets. Rows the phone can't do are left out. */
const API = process.env.REACT_APP_BACKEND_URL;
const label = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const canShareFiles = () => {
  try {
    return typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([''], 'card.png', { type: 'image/png' })] });
  } catch (e) {
    return false;
  }
};

const Row = ({ title, desc, onClick, disabled, testId }) => (
  <li className="border-b border-[var(--rule)]">
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId}
      className="w-full text-left flex items-center justify-between gap-4 py-[14px] text-[var(--text)] disabled:opacity-50">
      <span>
        <span className="block font-plex text-[16px] font-medium">{title}</span>
        {desc && <span className="block font-plex text-[13px] text-[var(--text-muted)] mt-0.5">{desc}</span>}
      </span>
      <span className="font-plex text-[18px] text-[var(--text-label)]" aria-hidden="true">›</span>
    </button>
  </li>
);

export const ShareSheet = ({ open, onClose, item, onNote }) => {
  // item: { kind: 'story' | 'edition', id, title, url, image }
  const [storyFile, setStoryFile] = useState(null);
  const [filesOk] = useState(canShareFiles);
  const panel = useRef(null);
  const isStory = item?.kind === 'story';

  // Make the Stories card as the sheet opens: iPhone only shows its share
  // menu straight from a tap, so the card has to be ready by then.
  useEffect(() => {
    if (!open || !isStory || !filesOk || storyFile?.id === item.id) return undefined;
    let live = true;
    fetch(`${API}/api/og-image/${encodeURIComponent(item.id)}?format=story`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!live || !blob) return;
        const file = new File([blob], `${item.id}-state-of-play.png`, { type: blob.type || 'image/png' });
        if (navigator.canShare({ files: [file] })) setStoryFile({ id: item.id, file });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [open, isStory, filesOk, item?.id, storyFile?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open || !item) return null;

  const { url, title } = item;
  const sent = (method) => track(isStory ? 'story_share' : 'lf_share', { [isStory ? 'story' : 'edition']: item.id, method });
  const go = (method, href) => {
    sent(method);
    window.open(href, '_blank', 'noopener');
    onClose();
  };

  const whatsapp = () => go('whatsapp', `https://wa.me/?text=${encodeURIComponent(`*${title}*\n\n${url}`)}`);
  const linkedin = () => go('linkedin', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
  const x = () => go('x', `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} via @stateofplayclub`)}&url=${encodeURIComponent(url)}`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      sent('copy_link');
      onNote?.('Link copied');
    } catch (e) {
      window.prompt('Copy this link:', url);
    }
    onClose();
  };

  const instagram = async () => {
    if (!storyFile) return;
    // The link goes on the clipboard for Instagram's link sticker. Not
    // awaited: the share menu has to open from the tap itself.
    navigator.clipboard?.writeText(url).catch(() => {});
    try {
      await navigator.share({ files: [storyFile.file] });
      sent('instagram_story');
      onNote?.('Link copied for a link sticker');
    } catch (e) { /* share menu closed */ }
    onClose();
  };

  const more = async () => {
    try {
      await navigator.share({ title, url });
      sent('share_sheet');
    } catch (e) { /* share menu closed */ }
    onClose();
  };

  const preview = isStory ? `${API}/api/og-image/${encodeURIComponent(item.id)}` : item.image;

  // At the page's top level: the story bar it opens from is blurred, which
  // would otherwise pin this sheet inside the bar.
  return createPortal(
    <div className="fixed inset-0 z-[60]" data-testid="share-sheet">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 cursor-default" data-testid="share-sheet-close" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Share"
        className="share-sheet absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto bg-[var(--bg)] border-t border-[var(--rule)] outline-none">
        <div className="max-w-[560px] mx-auto px-6 pt-5 pb-6">
          <div className="flex items-center justify-between border-b border-[var(--text)] pb-3">
            <p className={label}>Share</p>
            <button type="button" onClick={onClose} className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)]">Done</button>
          </div>
          {preview && (
            <div className="mt-4 border border-[var(--rule)]">
              <img src={preview} alt="" className="block w-full aspect-[1200/630] object-cover bg-[var(--rule)]" data-testid="share-preview" />
              <p className="px-3 py-2.5 font-plex text-[13px] text-[var(--text-muted)] truncate">{title}</p>
            </div>
          )}
          <ul className="mt-2">
            <Row title="WhatsApp" desc="The headline and the link" onClick={whatsapp} testId="sheet-whatsapp" />
            <Row title="LinkedIn" desc="The link, with this card" onClick={linkedin} testId="sheet-linkedin" />
            <Row title="X" desc="The headline and link, tagging @stateofplayclub" onClick={x} testId="sheet-x" />
            {isStory && filesOk && (
              <Row title="Instagram Story" testId="sheet-instagram"
                desc={storyFile ? 'A card made for Stories, with the link copied' : 'Making the card…'}
                onClick={instagram} disabled={!storyFile} />
            )}
            <Row title="Copy link" onClick={copy} testId="sheet-copy" />
            {typeof navigator.share === 'function' && (
              <Row title="More" desc="Your phone's share menu" onClick={more} testId="sheet-more" />
            )}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShareSheet;
