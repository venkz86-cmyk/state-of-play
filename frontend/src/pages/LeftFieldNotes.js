import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { StoryBody } from '../components/StoryLinkCard';
import { IS_APP_MODE } from '../lib/appMode';

/* The Left Field in the app: each edition whole, newest first (backend
   left_field_notes.py, read from Substack). The website keeps sending
   readers to Substack; an edition link opened outside the app goes to the
   edition there. */
const API = process.env.REACT_APP_BACKEND_URL;
const SUBSCRIBE_URL = 'https://theleftfield.substack.com/subscribe';

const dayShort = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '');
const dayLong = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '');
const meta = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const EditionCard = ({ ed, lead }) => (
  <li className="border-b border-[var(--rule)]">
    <Link to={`/left-field/e/${ed.slug}`} className="group block py-7" data-testid="lf-edition">
      {ed.image && (
        <div className="aspect-[16/9] mb-5 overflow-hidden bg-[var(--surface)]">
          <img src={ed.image} alt={ed.image_alt || ''} loading={lead ? 'eager' : 'lazy'} className="w-full h-full object-cover" data-testid="lf-edition-image" />
        </div>
      )}
      <p className={meta}>{lead ? `Latest · ${dayShort(ed.published)}` : dayShort(ed.published)}</p>
      <h2 className={`font-editorial leading-[1.12] mt-2.5 group-hover:text-[var(--text-muted)] transition-colors ${lead ? 'text-[30px]' : 'text-[24px]'}`}>
        {ed.title}
      </h2>
      {ed.subtitle && (
        <p className="font-reading text-[16px] leading-[1.55] text-[var(--text-muted)] mt-2.5 line-clamp-3">{ed.subtitle}</p>
      )}
    </Link>
  </li>
);

const EmailNote = () => (
  <p className="font-plex text-[13px] text-[var(--text-muted)] mt-10">
    Prefer it by email?{' '}
    <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--text)] underline underline-offset-4 decoration-[var(--rule)]">
      Get The Left Field in your inbox
    </a>
  </p>
);

export const LeftFieldFeed = () => {
  const [editions, setEditions] = useState(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async (p) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/left-field/editions?page=${p}`);
      if (!r.ok) throw new Error('load');
      const d = await r.json();
      setEditions((prev) => (p === 0 ? d.editions : [...(prev || []), ...d.editions]));
      setMore(d.more); setPage(p); setFailed(false);
    } catch (e) {
      setFailed(true); if (p === 0) setEditions([]);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(0); }, []);

  return (
    <MockupLayout testId="page-lf-feed" seo={{ title: 'The Left Field', path: '/left-field', noindex: true }}>
      <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-14 pb-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <Overline>The Left Field</Overline>
          <span className="font-plex text-[13px] text-[var(--text-muted)]">Twice a week, free</span>
        </div>
        {editions === null && <p className="font-plex text-[14px] text-[var(--text-muted)] py-8">Loading the latest editions…</p>}
        {editions && editions.length === 0 && (
          <p className="font-plex text-[15px] text-[var(--text-muted)] py-8" data-testid="lf-empty">
            {failed ? 'The editions didn’t load. Close the app and open it again to retry.' : 'Each new edition appears here.'}
          </p>
        )}
        {editions && editions.length > 0 && (
          <ul data-testid="lf-feed">{editions.map((ed, i) => <EditionCard key={ed.slug} ed={ed} lead={i === 0} />)}</ul>
        )}
        {more && (
          <button type="button" onClick={() => load(page + 1)} disabled={busy} data-testid="lf-more"
            className="mt-8 w-full h-12 border border-[var(--rule)] font-plex text-[14px] hover:border-[var(--text)] transition-colors disabled:opacity-60">
            {busy ? 'Loading…' : 'Earlier editions'}
          </button>
        )}
        <EmailNote />
      </div>
    </MockupLayout>
  );
};

export const LeftFieldEdition = () => {
  const { slug } = useParams();
  const [ed, setEd] = useState(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setEd(null); setMissing(false);
    fetch(`${API}/api/left-field/editions/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then((d) => {
        if (!live) return;
        // Outside the app, The Left Field lives on Substack.
        if (!IS_APP_MODE && d.url) { window.location.replace(d.url); return; }
        setEd(d);
      })
      .catch(() => live && setMissing(true));
    return () => { live = false; };
  }, [slug]);

  const share = async () => {
    const url = `https://www.stateofplay.club/left-field/e/${slug}`;
    try {
      if (navigator.share) { await navigator.share({ title: ed?.title || 'The Left Field', url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* share sheet closed */ }
  };

  return (
    <MockupLayout testId="page-lf-edition" seo={{ title: ed?.title || 'The Left Field', path: `/left-field/e/${slug}`, noindex: true }}>
      <article className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-14 pb-12">
        {missing && (
          <p className="font-plex text-[15px] text-[var(--text-muted)]">
            This edition isn’t here any more. <Link to="/left-field" className="underline underline-offset-4">See the latest editions</Link>
          </p>
        )}
        {!ed && !missing && <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>}
        {ed && (
          <>
            <p className={meta} data-testid="lf-edition-meta">The Left Field · {dayLong(ed.published)}</p>
            <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mt-4" data-testid="lf-edition-title">{ed.title}</h1>
            {ed.subtitle && <p className="font-reading text-[19px] leading-[1.5] text-[var(--text-muted)] mt-4">{ed.subtitle}</p>}
            {ed.author && <p className="font-plex text-[14px] text-[var(--text-muted)] mt-5">By {ed.author}</p>}
            <div className="mt-8 pt-8 border-t border-[var(--rule)]">
              <StoryBody html={ed.html} className="editorial-prose-quiet" data-testid="lf-edition-body" />
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
            <EmailNote />
          </>
        )}
      </article>
    </MockupLayout>
  );
};

// Links to single notes (October 13, before editions were shown whole)
// open the edition the note came from.
export const LeftFieldNote = () => {
  const { id } = useParams();
  return <Navigate to={`/left-field/e/${(id || '').replace(/-\d+$/, '')}`} replace />;
};
