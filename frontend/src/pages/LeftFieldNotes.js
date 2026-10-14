import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { StoryBody } from '../components/StoryLinkCard';
import { IS_APP_MODE } from '../lib/appMode';
import { markRead, readSlugs } from '../lib/leftFieldRead';
import { track } from '../lib/analytics';
import { ShareSheet } from '../components/ShareSheet';

/* The Left Field in the app (backend left_field_notes.py, read from
   Substack). Built around how it gets read: most visits are for the newest
   edition, so the tab opens on it, whole, with its headlines at the top to
   skim and jump to. Earlier editions sit below as a short list (date,
   title, first headlines). The tab bar marks an edition the reader hasn't
   opened (lib/leftFieldRead.js).

   The website keeps sending readers to Substack; an edition link opened
   outside the app goes to the edition there. */
const API = process.env.REACT_APP_BACKEND_URL;
const SUBSCRIBE_URL = 'https://theleftfield.substack.com/subscribe';

const dayLong = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '');
const dayShort = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const label = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const getJSON = async (path) => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

// "In this edition": a section heading (The Signals) over its items; a
// heading with no items under it (The Position, The Stack) on its own.
const groupContents = (contents) => {
  const groups = [];
  contents.forEach((c, i) => {
    const next = contents[i + 1];
    if (c.level === 2 && next && next.level === 3) groups.push({ section: c.title, items: [] });
    else if (c.level === 2) groups.push({ section: null, items: [c] });
    else if (groups.length && groups[groups.length - 1].section) groups[groups.length - 1].items.push(c);
    else groups.push({ section: null, items: [c] });
  });
  return groups;
};

const jump = (id) => {
  track('lf_contents_jump', { to: id });
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

const Contents = ({ contents }) => {
  const groups = groupContents(contents || []);
  if (!groups.length) return null;
  return (
    <nav aria-label="In this edition" className="mt-8 border-t border-[var(--text)] pt-4" data-testid="lf-contents">
      <p className={label}>In this edition</p>
      <ul className="mt-2">
        {groups.map((g, gi) => (
          <li key={gi} className="border-b border-[var(--rule)] last:border-b-0 py-3">
            {g.section && <p className="font-plex text-[12px] font-medium text-[var(--text-muted)] mb-1.5">{g.section}</p>}
            <ul className="space-y-1.5">
              {g.items.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => jump(c.id)}
                    className="group w-full text-left flex items-baseline gap-3 font-editorial text-[18px] leading-snug text-[var(--text)]">
                    <span aria-hidden="true" className="shrink-0 h-[6px] w-[6px] translate-y-[-3px] bg-[var(--accent-blue)]" />
                    <span className="group-hover:text-[var(--text-muted)] transition-colors">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const Edition = ({ ed, isNew, latest }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);
  const url = `https://www.stateofplay.club/left-field/e/${ed.slug}`;
  const share = async () => {
    if (IS_APP_MODE) { setSharing(true); return; }
    try {
      if (navigator.share) { await navigator.share({ title: ed.title, url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* share sheet closed */ }
  };
  return (
    <article data-testid="lf-edition">
      <div className="flex items-center gap-3">
        <p className={label} data-testid="lf-edition-meta">{latest ? 'Latest' : 'The Left Field'} · {dayLong(ed.published)}</p>
        {isNew && <span className="font-plex text-[10px] uppercase tracking-[0.12em] font-semibold text-white bg-[var(--accent-blue)] px-1.5 py-[3px] leading-none" data-testid="lf-new">New</span>}
      </div>
      <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.08] mt-3" data-testid="lf-edition-title">{ed.title}</h1>
      <p className="font-plex text-[14px] text-[var(--text-muted)] mt-4">
        {[ed.author ? `By ${ed.author}` : null, ed.minutes ? `${ed.minutes} min read` : null].filter(Boolean).join(' · ')}
      </p>
      <Contents contents={ed.contents} />
      <div className="mt-8 pt-8 border-t border-[var(--rule)]">
        <StoryBody html={ed.html} className="editorial-prose-quiet lf-edition-body" data-testid="lf-edition-body" />
      </div>
      <div className="mt-10 pt-6 border-t border-[var(--rule)] flex flex-wrap items-center justify-between gap-4">
        <a href={ed.url} target="_blank" rel="noopener noreferrer" data-testid="lf-edition-substack"
          className="font-plex text-[14px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
          Read on Substack
        </a>
        <button type="button" onClick={share} data-testid="lf-edition-share"
          className="inline-flex items-center gap-2 font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)]">
          <Share2 className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" /> {copied ? 'Link copied' : 'Share'}
        </button>
      </div>
      <ShareSheet open={sharing} onClose={closeShare}
        onNote={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        item={{ kind: 'edition', id: ed.slug, title: ed.title, url, image: ed.image || '/og/left-field.png' }} />
    </article>
  );
};

// Earlier editions: date, title and the first two headlines, so a reader
// can tell them apart without opening them.
const Earlier = ({ exclude }) => {
  const [list, setList] = useState(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = async (p) => {
    setBusy(true);
    try {
      const d = await getJSON(`/api/left-field/editions?page=${p}`);
      setList((prev) => [...(p === 0 ? [] : prev || []), ...d.editions]);
      setMore(d.more); setPage(p);
    } catch (e) { if (p === 0) setList([]); } finally { setBusy(false); }
  };
  useEffect(() => { load(0); }, []);
  const rows = (list || []).filter((e) => e.slug !== exclude);
  if (!rows.length) return null;
  return (
    <section className="mt-14" data-testid="lf-earlier">
      <div className="border-b border-[var(--text)] pb-3"><p className={label}>Earlier editions</p></div>
      <ul>
        {rows.map((e) => {
          const heads = (e.contents || []).filter((c) => c.level === 3).slice(0, 2).map((c) => c.title);
          return (
            <li key={e.slug} className="border-b border-[var(--rule)]">
              <Link to={`/left-field/e/${e.slug}`} className="group block py-5" data-testid="lf-earlier-row">
                <p className={label}>{dayShort(e.published)}</p>
                <p className="font-editorial text-[21px] leading-[1.2] mt-1.5 group-hover:text-[var(--text-muted)] transition-colors">{e.title}</p>
                {heads.length > 0 && <p className="font-plex text-[14px] leading-[1.45] text-[var(--text-muted)] mt-1.5 line-clamp-2">{heads.join(' · ')}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
      {more && (
        <button type="button" onClick={() => load(page + 1)} disabled={busy} data-testid="lf-more"
          className="mt-8 w-full h-12 border border-[var(--rule)] font-plex text-[14px] hover:border-[var(--text)] transition-colors disabled:opacity-60">
          {busy ? 'Loading…' : 'More editions'}
        </button>
      )}
    </section>
  );
};

const EmailNote = () => (
  <p className="font-plex text-[13px] text-[var(--text-muted)] mt-12">
    Prefer it by email?{' '}
    <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--text)] underline underline-offset-4 decoration-[var(--rule)]">
      Get The Left Field in your inbox
    </a>
  </p>
);

const Shell = ({ testId, title, path, children }) => (
  <MockupLayout testId={testId} seo={{ title, path, noindex: true }}>
    <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-8 lg:pt-14 pb-12">
      <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3 mb-8">
        <Overline>The Left Field</Overline>
        <span className="font-plex text-[13px] text-[var(--text-muted)]">Twice a week, free</span>
      </div>
      {children}
      <EmailNote />
    </div>
  </MockupLayout>
);

// Opens an edition: fetches it, remembers it was read, and says whether it
// was new to this reader before this visit.
const useEdition = (slugOrLatest) => {
  const [state, setState] = useState({ ed: null, missing: false, isNew: false, latestSlug: null });
  useEffect(() => {
    let live = true;
    setState({ ed: null, missing: false, isNew: false, latestSlug: null });
    (async () => {
      try {
        let slug = slugOrLatest;
        let latestSlug = null;
        if (!slug) {
          const d = await getJSON('/api/left-field/editions?page=0');
          slug = d.editions?.[0]?.slug;
          latestSlug = slug;
          if (!slug) { if (live) setState((s) => ({ ...s, missing: true })); return; }
        }
        const ed = await getJSON(`/api/left-field/editions/${encodeURIComponent(slug)}`);
        if (!live) return;
        // Outside the app, The Left Field lives on Substack.
        if (!IS_APP_MODE && slugOrLatest && ed.url) { window.location.replace(ed.url); return; }
        const isNew = !readSlugs().has(ed.slug);
        markRead(ed.slug);
        track('lf_edition_open', { edition: ed.slug, latest: !slugOrLatest, first_time: isNew });
        setState({ ed, missing: false, isNew, latestSlug });
      } catch (e) {
        if (live) setState((s) => ({ ...s, missing: true }));
      }
    })();
    return () => { live = false; };
  }, [slugOrLatest]);
  return state;
};

// The tab: the newest edition, whole, then the earlier ones.
export const LeftFieldFeed = () => {
  const { ed, missing, isNew } = useEdition(null);
  return (
    <Shell testId="page-lf-feed" title="The Left Field" path="/left-field">
      {!ed && !missing && <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading the latest edition…</p>}
      {missing && (
        <p className="font-plex text-[15px] text-[var(--text-muted)]" data-testid="lf-empty">
          The latest edition didn’t load. Close the app and open it again to retry.
        </p>
      )}
      {ed && <Edition ed={ed} isNew={isNew} latest />}
      {ed && <Earlier exclude={ed.slug} />}
    </Shell>
  );
};

// One edition, from the list below an edition, a share link or a notification.
export const LeftFieldEdition = () => {
  const { slug } = useParams();
  const { ed, missing, isNew } = useEdition(slug);
  return (
    <Shell testId="page-lf-edition" title={ed?.title || 'The Left Field'} path={`/left-field/e/${slug}`}>
      {!ed && !missing && <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>}
      {missing && (
        <p className="font-plex text-[15px] text-[var(--text-muted)]">
          This edition isn’t here any more. <Link to="/left-field" className="underline underline-offset-4">Read the latest one</Link>
        </p>
      )}
      {ed && <Edition ed={ed} isNew={isNew} />}
      {ed && <Earlier exclude={ed.slug} />}
    </Shell>
  );
};

// Links to single notes (October 13, before editions were shown whole)
// open the edition the note came from.
export const LeftFieldNote = () => {
  const { id } = useParams();
  return <Navigate to={`/left-field/e/${(id || '').replace(/-\d+$/, '')}`} replace />;
};
