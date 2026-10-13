import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { StoryBody } from '../components/StoryLinkCard';
import { IS_APP_MODE } from '../lib/appMode';

/* The Left Field in the app: a running feed of notes (backend
   left_field_notes.py), newest first, each note standing on its own. The
   website keeps sending readers to Substack; a shared note link opened
   outside the app goes to the full edition there. */
const API = process.env.REACT_APP_BACKEND_URL;
const SUBSCRIBE_URL = 'https://theleftfield.substack.com/subscribe';

const dayShort = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '');
const dayLong = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '');
const meta = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const NoteCard = ({ note }) => (
  <li className="border-b border-[var(--rule)]">
    <Link to={`/left-field/n/${note.id}`} className="group block py-7" data-testid="lf-note">
      <p className={meta}>
        {dayShort(note.published)}{note.kind === 'opener' ? ' · Opener' : ''}
      </p>
      {note.headline && (
        <h2 className="font-editorial text-[24px] leading-[1.18] mt-2.5 group-hover:text-[var(--text-muted)] transition-colors">{note.headline}</h2>
      )}
      <div
        className={`lf-note-teaser font-reading text-[17px] leading-[1.6] mt-3 line-clamp-4 ${note.headline ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}`}
        dangerouslySetInnerHTML={{ __html: note.first_html }}
      />
      {(note.more || note.kind === 'opener') && <p className="font-plex text-[13px] mt-3 text-[var(--text)] underline underline-offset-4 decoration-[var(--rule)]">Read the note</p>}
    </Link>
  </li>
);

export const LeftFieldFeed = () => {
  const [notes, setNotes] = useState(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async (p) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/left-field/notes?page=${p}`);
      if (!r.ok) throw new Error('load');
      const d = await r.json();
      setNotes((prev) => (p === 0 ? d.notes : [...(prev || []), ...d.notes]));
      setMore(d.more); setPage(p); setFailed(false);
    } catch (e) {
      setFailed(true); if (p === 0) setNotes([]);
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
        {notes === null && <p className="font-plex text-[14px] text-[var(--text-muted)] py-8">Loading the latest notes…</p>}
        {notes && notes.length === 0 && (
          <p className="font-plex text-[15px] text-[var(--text-muted)] py-8" data-testid="lf-empty">
            {failed ? 'The notes didn’t load. Close the app and open it again to retry.' : 'Notes appear here with each new edition.'}
          </p>
        )}
        {notes && notes.length > 0 && <ul data-testid="lf-feed">{notes.map((n) => <NoteCard key={n.id} note={n} />)}</ul>}
        {more && (
          <button type="button" onClick={() => load(page + 1)} disabled={busy} data-testid="lf-more"
            className="mt-8 w-full h-12 border border-[var(--rule)] font-plex text-[14px] hover:border-[var(--text)] transition-colors disabled:opacity-60">
            {busy ? 'Loading…' : 'Earlier notes'}
          </button>
        )}
        <p className="font-plex text-[13px] text-[var(--text-muted)] mt-10">
          Prefer it by email?{' '}
          <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--text)] underline underline-offset-4 decoration-[var(--rule)]">
            Get The Left Field in your inbox
          </a>
        </p>
      </div>
    </MockupLayout>
  );
};

export const LeftFieldNote = () => {
  const { id } = useParams();
  const [note, setNote] = useState(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${API}/api/left-field/notes/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then((d) => {
        if (!live) return;
        // Outside the app, The Left Field lives on Substack.
        if (!IS_APP_MODE && d.edition_url) { window.location.replace(d.edition_url); return; }
        setNote(d);
      })
      .catch(() => live && setMissing(true));
    return () => { live = false; };
  }, [id]);

  const share = async () => {
    const url = `https://www.stateofplay.club/left-field/n/${id}`;
    const title = note?.headline || 'The Left Field';
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* share sheet closed */ }
  };

  return (
    <MockupLayout testId="page-lf-note" seo={{ title: note?.headline || 'The Left Field', path: `/left-field/n/${id}`, noindex: true }}>
      <article className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-14 pb-12">
        {missing && (
          <p className="font-plex text-[15px] text-[var(--text-muted)]">
            This note isn’t here any more. <Link to="/left-field" className="underline underline-offset-4">See the latest notes</Link>
          </p>
        )}
        {!note && !missing && <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>}
        {note && (
          <>
            <p className={meta} data-testid="lf-note-meta">
              The Left Field · {dayLong(note.published)}{note.kind === 'opener' ? ' · Opener' : ''}
            </p>
            {note.headline && (
              <h1 className="font-editorial text-[32px] md:text-[40px] leading-[1.12] mt-4" data-testid="lf-note-headline">{note.headline}</h1>
            )}
            <div className="mt-6">
              <StoryBody html={note.html} className="editorial-prose-quiet" data-testid="lf-note-body" />
            </div>
            <div className="mt-10 pt-6 border-t border-[var(--rule)] flex flex-wrap items-center justify-between gap-4">
              <a href={note.edition_url} target="_blank" rel="noopener noreferrer" data-testid="lf-note-edition"
                className="font-plex text-[14px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
                Read the full edition on Substack
              </a>
              <button type="button" onClick={share} data-testid="lf-note-share"
                className="inline-flex items-center gap-2 font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)]">
                <Share2 className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" /> {copied ? 'Link copied' : 'Share'}
              </button>
            </div>
          </>
        )}
      </article>
    </MockupLayout>
  );
};
