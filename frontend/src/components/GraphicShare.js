import { useCallback, useEffect, useState } from 'react';
import { ShareSheet } from './ShareSheet';
import { track } from '../lib/analytics';

/* In the app, a share button on each graphic Venkat marked in Ghost (alt
   text starting "Graphic:", which shows nowhere). Tapping it opens the
   share sheet with the graphic framed in the house style
   (backend story_graphics.py). Graphics are counted in the order they
   appear, as the server counts them. The website shows no button. */
const MARK = /^\s*graphic\b[^:]*:/i;
const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M12 3.5V14.5"/><path d="M8 7.5L12 3.5L16 7.5"/><path d="M8.5 10.5H5V20.5H19V10.5H15.5"/></svg>';

export const GraphicShare = ({ html, article }) => {
  const [item, setItem] = useState(null);
  const close = useCallback(() => setItem(null), []);
  const slug = article?.slug || article?.id;

  useEffect(() => {
    const body = document.querySelector('[data-testid="article-body"]');
    if (!body || !slug) return undefined;
    const mark = () => {
      const imgs = [...body.querySelectorAll('img')].filter((img) => MARK.test(img.getAttribute('alt') || ''));
      imgs.forEach((img, n) => {
        const holder = img.closest('figure') || img.parentElement;
        if (!holder || holder.querySelector(':scope > .graphic-share')) return;
        holder.classList.add('has-graphic-share');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'graphic-share';
        btn.dataset.graphic = String(n);
        btn.dataset.testid = 'graphic-share';
        btn.setAttribute('aria-label', 'Share this graphic');
        btn.innerHTML = ICON;
        holder.appendChild(btn);
      });
    };
    mark();
    const watch = new MutationObserver(mark);
    watch.observe(body, { childList: true, subtree: true });
    const onClick = (e) => {
      const btn = e.target.closest?.('.graphic-share');
      if (!btn) return;
      e.preventDefault();
      const n = Number(btn.dataset.graphic);
      track('graphic_share_open', { story: slug, graphic: n + 1 });
      setItem({ kind: 'graphic', id: slug, n, title: article.title, url: `https://www.stateofplay.club/${slug}` });
    };
    body.addEventListener('click', onClick);
    return () => { watch.disconnect(); body.removeEventListener('click', onClick); };
  }, [html, slug, article?.title]);

  return <ShareSheet open={!!item} onClose={close} item={item} />;
};

export default GraphicShare;
