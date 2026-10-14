import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { track } from '../lib/analytics';

/* The app's Share sheet, for stories, Left Field editions and the graphics
   marked in a story (story_graphics.py). Each place
   gets what shows best there: WhatsApp gets the headline in bold over the
   link (WhatsApp draws the preview card from the link), X gets the headline
   and @stateofplayclub, LinkedIn just the link (it builds its own card),
   and Instagram, which takes no links, gets a tall card made for Stories
   (/api/og-image/<slug>?format=story) with the link copied for a link
   sticker. The card the link will show sits at the top, so a reader sees
   what the other person gets. A graphic goes out as an image framed with
   the headline, the story's link as its message. Rows the phone can't do
   are left out. */
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

// The images each kind of share hands to the phone's share menu.
const imagesFor = (item) => {
  const slug = encodeURIComponent(item.id);
  if (item.kind === 'story') return { story: `${API}/api/og-image/${slug}?format=story` };
  if (item.kind === 'graphic') {
    const base = `${API}/api/story-graphic/${slug}/${item.n}`;
    return { post: `${base}?format=post`, story: `${base}?format=story` };
  }
  return {};
};

export const ShareSheet = ({ open, onClose, item, onNote }) => {
  // item: { kind: 'story' | 'edition' | 'graphic', id, title, url, image, n }
  const [files, setFiles] = useState({});
  const [filesOk] = useState(canShareFiles);
  const panel = useRef(null);
  const isStory = item?.kind === 'story';
  const isGraphic = item?.kind === 'graphic';
  const key = item ? `${item.kind}:${item.id}:${item.n ?? ''}` : '';

  // Make the images as the sheet opens: iPhone only shows its share menu
  // straight from a tap, so they have to be ready by then.
  const fetched = useRef('');
  useEffect(() => {
    if (!open || !item || fetched.current === key) return;
    const wanted = Object.entries(imagesFor(item));
    if (!wanted.length || (!filesOk && !isGraphic)) return;
    fetched.current = key;
    setFiles({ key });
    wanted.forEach(([name, src]) => {
      fetch(src)
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (!blob) return;
          const suffix = item.kind === 'graphic' ? `graphic-${item.n + 1}${name === 'story' ? '-story' : ''}` : 'state-of-play';
          const file = new File([blob], `${item.id}-${suffix}.png`, { type: blob.type || 'image/png' });
          setFiles((f) => (f.key === key ? { ...f, [name]: file } : f));
        })
        .catch(() => { fetched.current = ''; });
    });
  }, [open, item, key, filesOk, isGraphic]);

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
  const sent = (method) => {
    if (isGraphic) track('graphic_share', { story: item.id, graphic: item.n + 1, method });
    else track(isStory ? 'story_share' : 'lf_share', { [isStory ? 'story' : 'edition']: item.id, method });
  };
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

  const shareFile = async (file, method, data = {}) => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], ...data });
      sent(method);
      return true;
    } catch (e) {
      return false; /* share menu closed */
    } finally {
      onClose();
    }
  };

  const instagram = async () => {
    // The link goes on the clipboard for Instagram's link sticker. Not
    // awaited: the share menu has to open from the tap itself.
    navigator.clipboard?.writeText(url).catch(() => {});
    if (await shareFile(files.story, 'instagram_story')) onNote?.('Link copied for a link sticker');
  };

  // The graphic with the story's link as its message, for WhatsApp,
  // LinkedIn and the rest of the phone's share menu.
  const shareGraphic = () => shareFile(files.post, 'image', { text: `${title}\n${url}` });

  const save = () => {
    if (!files.post) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(files.post);
    a.download = files.post.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    sent('save');
    onClose();
  };

  const more = async () => {
    try {
      await navigator.share({ title, url });
      sent('share_sheet');
    } catch (e) { /* share menu closed */ }
    onClose();
  };

  const preview = isGraphic ? imagesFor(item).post : isStory ? `${API}/api/og-image/${encodeURIComponent(item.id)}` : item.image;
  const making = 'Making the image…';

  // At the page's top level: the story bar it opens from is blurred, which
  // would otherwise pin this sheet inside the bar.
  return createPortal(
    <div className="fixed inset-0 z-[60]" data-testid="share-sheet">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 cursor-default" data-testid="share-sheet-close" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Share"
        className="share-sheet absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto bg-[var(--bg)] border-t border-[var(--rule)] outline-none">
        <div className="max-w-[560px] mx-auto px-6 pt-5 pb-6">
          <div className="flex items-center justify-between border-b border-[var(--text)] pb-3">
            <p className={label}>{isGraphic ? 'Share this graphic' : 'Share'}</p>
            <button type="button" onClick={onClose} className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)]">Done</button>
          </div>
          {preview && (
            <div className="mt-4 border border-[var(--rule)]">
              <img src={preview} alt="" data-testid="share-preview"
                className={`block w-full bg-[var(--rule)] ${isGraphic ? 'aspect-[1080/1350] max-h-[42vh] object-contain' : 'aspect-[1200/630] object-cover'}`} />
              {!isGraphic && <p className="px-3 py-2.5 font-plex text-[13px] text-[var(--text-muted)] truncate">{title}</p>}
            </div>
          )}
          {isGraphic ? (
            <ul className="mt-2">
              {filesOk && (
                <Row title="Share the graphic" desc={files.post ? "With the story's link, to any app" : making}
                  onClick={shareGraphic} disabled={!files.post} testId="sheet-graphic" />
              )}
              {filesOk && (
                <Row title="Instagram Story" desc={files.story ? 'A tall version, with the link copied' : making}
                  onClick={instagram} disabled={!files.story} testId="sheet-instagram" />
              )}
              <Row title="Save image" onClick={save} disabled={!files.post} testId="sheet-save" />
              <Row title="Copy the story's link" onClick={copy} testId="sheet-copy" />
            </ul>
          ) : (
          <ul className="mt-2">
            <Row title="WhatsApp" desc="The headline and the link" onClick={whatsapp} testId="sheet-whatsapp" />
            <Row title="LinkedIn" desc="The link, with this card" onClick={linkedin} testId="sheet-linkedin" />
            <Row title="X" desc="The headline and link, tagging @stateofplayclub" onClick={x} testId="sheet-x" />
            {isStory && filesOk && (
              <Row title="Instagram Story" testId="sheet-instagram"
                desc={files.story ? 'A card made for Stories, with the link copied' : 'Making the card…'}
                onClick={instagram} disabled={!files.story} />
            )}
            <Row title="Copy link" onClick={copy} testId="sheet-copy" />
            {typeof navigator.share === 'function' && (
              <Row title="More" desc="Your phone's share menu" onClick={more} testId="sheet-more" />
            )}
          </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShareSheet;
