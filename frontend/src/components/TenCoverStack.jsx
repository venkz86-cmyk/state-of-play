import { useEffect, useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

// Ghost serves resized copies of its own images under /size/wN/.
const sized = (url, width) =>
  url && url.includes('/content/images/') && !url.includes('/content/images/size/')
    ? url.replace('/content/images/', `/content/images/size/w${width}/`)
    : url;

// A small, fixed tilt per layer so the pile looks hand-stacked rather
// than generated. Index 0 is the top card.
const TILT = [0, -2.5, 1.8, -1.2, 2.6, -3.2, 1.1, -1.8, 2.9, -0.8];

const LABEL = 'The ten stories you get';

const Cover = ({ cover, width }) =>
  cover.feature_image ? (
    <img
      src={sized(cover.feature_image, width)}
      alt={cover.title}
      loading="lazy"
      className="w-full h-full object-cover block"
    />
  ) : (
    <div className="w-full h-full bg-[var(--surface)] flex items-end p-3">
      <span className="font-editorial text-[15px] leading-tight text-[var(--text)]">{cover.title}</span>
    </div>
  );

/* The covers of The Ten (GET /api/trial/the-ten/covers: Venkat's
   curated list, titles and images only). A fanned pile on desktop, a
   row of overlapping thumbnails on phones. Not links: the stack shows
   what a buyer gets, it isn't a way in. Renders nothing if the covers
   don't load, so the page falls back to how it looked before. */
export const TenCoverStack = ({ variant = 'stack' }) => {
  const [covers, setCovers] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/trial/the-ten/covers`)
      .then((r) => (r.ok ? r.json() : { covers: [] }))
      .then((data) => { if (active) setCovers((data.covers || []).slice(0, 10)); })
      .catch(() => { if (active) setCovers([]); });
    return () => { active = false; };
  }, []);

  const usable = covers && covers.filter((c) => c.feature_image).length >= 3;

  if (variant === 'row') {
    if (!usable) return null;
    return (
      <figure data-testid="ten-cover-row" aria-label={LABEL} className="mt-8">
        <div className="flex items-end pt-2 px-1">
          {covers.map((c, i) => (
            <div
              key={c.slug}
              className="relative w-[18%] aspect-[3/4]"
              style={{ marginLeft: i === 0 ? 0 : '-9.1%', zIndex: covers.length - i, '--i': i, transform: `rotate(${(TILT[i] || 0) * 0.8}deg)` }}
            >
              <div className="ten-row-card w-full h-full border border-[var(--rule)] bg-[var(--bg)] overflow-hidden shadow-[0_6px_14px_-8px_rgba(0,0,0,0.45)]">
                <Cover cover={c} width={300} />
              </div>
            </div>
          ))}
        </div>
        <figcaption className="font-plex text-[13px] text-[var(--text-label)] mt-3">{LABEL}</figcaption>
      </figure>
    );
  }

  // Desktop pile. A fixed frame while loading keeps the hero from jumping.
  if (covers === null) return <div className="ten-stack-frame" aria-hidden="true" />;
  if (!usable) return null;
  const top = covers[0];
  return (
    <figure data-testid="ten-cover-stack" aria-label={LABEL} className="ten-stack-frame ten-stack group">
      {covers.map((c, i) => (
        <div
          key={c.slug}
          className="ten-stack-card"
          style={{ '--i': i, '--tilt': TILT[i] || 0, zIndex: covers.length - i }}
          aria-hidden={i === 0 ? undefined : 'true'}
        >
          <div className="ten-stack-inner border border-[var(--rule)] bg-[var(--bg)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
            <div className="aspect-[3/2] overflow-hidden">
              <Cover cover={c} width={750} />
            </div>
            <div className="px-4 py-3 border-t border-[var(--rule)]">
              <p className="font-editorial text-[17px] leading-snug text-[var(--text)] line-clamp-2">{c.title}</p>
              <p className="font-plex text-[12px] text-[var(--text-label)] mt-1">{shortDate(c.published_at)}</p>
            </div>
          </div>
        </div>
      ))}
      <span
        className="ten-stack-tab font-editorial text-white bg-[var(--accent-burgundy)] text-[20px] leading-none px-3 py-2"
        aria-hidden="true"
        title={top ? LABEL : undefined}
      >
        {covers.length}
      </span>
    </figure>
  );
};

export default TenCoverStack;
