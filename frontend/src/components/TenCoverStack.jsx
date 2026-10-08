import { useEffect, useRef, useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

const shortDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
};

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
  // Desktop: which cover is on top, and whether it's sliding off.
  const [start, setStart] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [turned, setTurned] = useState(false);
  const timer = useRef(null);
  // Phone: the thumbnail whose title is showing.
  const [picked, setPicked] = useState(null);
  useEffect(() => () => clearTimeout(timer.current), []);

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
    const shown = picked === null ? null : covers[picked];
    return (
      <figure data-testid="ten-cover-row" aria-label={LABEL} className="mt-8">
        <div className="flex items-end pt-3 px-1">
          {covers.map((c, i) => (
            <button
              type="button"
              key={c.slug}
              onClick={() => setPicked(picked === i ? null : i)}
              aria-label={c.title}
              aria-pressed={picked === i}
              data-testid="ten-row-thumb"
              className="ten-row-thumb relative w-[18%] aspect-[3/4] p-0 border-0 bg-transparent"
              style={{
                marginLeft: i === 0 ? 0 : '-9.1%',
                zIndex: picked === i ? 30 : covers.length - i,
                '--i': i,
                transform: `rotate(${(TILT[i] || 0) * 0.8}deg) translateY(${picked === i ? -10 : 0}px)`,
              }}
            >
              <div className={`ten-row-card w-full h-full border bg-[var(--bg)] overflow-hidden shadow-[0_6px_14px_-8px_rgba(0,0,0,0.45)] ${picked === i ? 'border-[var(--accent-burgundy)]' : 'border-[var(--rule)]'}`}>
                <Cover cover={c} width={300} />
              </div>
            </button>
          ))}
        </div>
        <figcaption className="mt-3 min-h-[40px]" aria-live="polite" data-testid="ten-row-caption">
          {shown ? (
            <>
              <span className="block font-editorial text-[16px] leading-snug text-[var(--text)]">{shown.title}</span>
              {shortDate(shown.published_at) && (
                <span className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mt-1">{shortDate(shown.published_at)}</span>
              )}
            </>
          ) : (
            <span className="font-plex text-[13px] text-[var(--text-label)]">{LABEL}. Tap a cover for its title.</span>
          )}
        </figcaption>
      </figure>
    );
  }

  // Desktop pile. A fixed frame while loading keeps the hero from jumping.
  if (covers === null) return <div className="ten-stack-frame" aria-hidden="true" />;
  if (!usable) return null;
  const n = covers.length;
  const ordered = covers.map((_, k) => covers[(start + k) % n]);
  const next = () => {
    if (leaving) return;
    setTurned(true);
    setLeaving(true);
    timer.current = setTimeout(() => {
      setStart((v) => (v + 1) % n);
      setLeaving(false);
    }, 260);
  };
  const prev = () => { if (!leaving) { setTurned(true); setStart((v) => (v - 1 + n) % n); } };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
  };
  return (
    <figure data-testid="ten-cover-stack" className="ten-stack-figure">
      <div
        role="button"
        tabIndex={0}
        onClick={next}
        onKeyDown={onKey}
        aria-label={`${LABEL}. Showing ${start + 1} of ${n}: ${ordered[0].title}. Press for the next one.`}
        className="ten-stack-frame ten-stack group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-burgundy)] focus-visible:ring-offset-4"
      >
        {ordered.map((c, i) => (
          <div
            key={c.slug}
            className={`ten-stack-card ${i === 0 && leaving ? 'ten-stack-leaving' : ''}`}
            style={{ '--i': i, '--tilt': TILT[i] || 0, zIndex: n - i }}
            aria-hidden="true"
          >
            <div className="ten-stack-inner border border-[var(--rule)] bg-[var(--bg)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
              <div className="aspect-[3/2] overflow-hidden">
                <Cover cover={c} width={750} />
              </div>
              <div className="px-5 pt-4 pb-5 border-t border-[var(--rule)]">
                <p className="font-editorial text-[21px] leading-[1.2] text-[var(--text)] line-clamp-2">{c.title}</p>
                {shortDate(c.published_at) && (
                  <p className="font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)] mt-2">{shortDate(c.published_at)}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        <span className="ten-stack-seal" aria-hidden="true">
          <span className="font-editorial text-[30px] leading-none">{n}</span>
          <span className="font-plex text-[9px] uppercase tracking-[0.14em] mt-1">stories</span>
        </span>
      </div>
      <figcaption className="flex items-baseline justify-between gap-4 mt-6 max-w-[520px] ml-auto font-plex text-[13px] text-[var(--text-label)]">
        <span data-testid="ten-stack-count" className="tabular-nums">{start + 1} of {n}</span>
        <span>{turned ? 'Click for the next one' : 'Click the pile to flip through'}</span>
      </figcaption>
    </figure>
  );
};

export default TenCoverStack;
