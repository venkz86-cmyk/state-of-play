import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { useAuth } from '../contexts/AuthContext';
import { authHeader } from '../lib/sessionToken';

const API = process.env.REACT_APP_BACKEND_URL;

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

export const STATUS_LABELS = {
  heard: 'Heard',
  checking: 'Checking',
  confirmed: 'Confirmed',
  didnt_hold: "Didn't hold up",
};

// Semantic colours for the status chip: neutral while a note is open,
// green once it held, struck through once it didn't.
const STATUS_STYLES = {
  heard: 'border-[var(--rule)] text-[var(--text)]',
  checking: 'border-[var(--accent-burgundy)] text-[var(--accent-burgundy)]',
  confirmed: 'border-[#2F6B3A] text-[#2F6B3A] dark:border-[#7FBF8A] dark:text-[#7FBF8A]',
  didnt_hold: 'border-[var(--rule)] text-[var(--text-label)] line-through',
};

export const StatusChip = ({ status }) => (
  <span
    data-testid={`mz-status-${status}`}
    className={`inline-block border px-2 py-[2px] font-plex text-[11px] uppercase tracking-[0.06em] ${STATUS_STYLES[status] || STATUS_STYLES.heard}`}
    style={{ borderRadius: 'var(--control-radius)' }}
  >
    {STATUS_LABELS[status] || status}
  </span>
);

const STATUS_KEY = [
  ['heard', 'Someone told me.'],
  ['checking', "I'm working on it."],
  ['confirmed', 'It held up. The story link follows when it runs.'],
  ['didnt_hold', "I couldn't confirm it, or it turned out to be wrong."],
];

const StatusKey = () => (
  <>
    <h2 className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4">What the labels mean</h2>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-1">
      {STATUS_KEY.map(([status, meaning]) => (
        <div key={status}>
          <dt><StatusChip status={status} /></dt>
          <dd className="font-plex text-sm text-[var(--text-muted)] mt-1">{meaning}</dd>
        </div>
      ))}
    </dl>
  </>
);

const P = ({ children }) => (
  <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">{children}</p>
);

const buttonClass =
  'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-11 px-6 transition-colors duration-200 disabled:opacity-60';
const linkClass = 'text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors';

const ReplyBox = ({ dropId }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [quoteOk, setQuoteOk] = useState(false);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  if (state === 'sent') {
    return (
      <p data-testid="mz-reply-sent" className="font-plex text-sm text-[var(--text)] mt-4">
        Thank you. It's with me, and nobody else will see it.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="mz-reply-open"
        className="mt-4 font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2"
      >
        Know something about this?
      </button>
    );
  }

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setState('sending');
    setError('');
    try {
      const res = await fetch(`${API}/api/mixed-zone/${dropId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ body, title, quote_ok: quoteOk && !!title.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'That did not go through. Please try again.');
      }
      setState('sent');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  return (
    <form onSubmit={send} className="mt-4 space-y-3 max-w-[560px]" data-testid="mz-reply-form">
      <label className="block">
        <span className="font-plex text-sm text-[var(--text)]">Know something about this?</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="What have you heard?"
          data-testid="mz-reply-body"
          className="mt-1 w-full border border-[var(--rule)] bg-[var(--bg)] text-[var(--text)] font-plex text-base p-3 focus:outline-none focus:border-[var(--text)]"
          style={{ borderRadius: 'var(--control-radius)' }}
        />
      </label>
      <label className="block">
        <span className="font-plex text-sm text-[var(--text)]">Your title (optional)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Banker, Mumbai"
          data-testid="mz-reply-title"
          className="mt-1 w-full border border-[var(--rule)] bg-[var(--bg)] text-[var(--text)] font-plex text-base h-11 px-3 focus:outline-none focus:border-[var(--text)]"
          style={{ borderRadius: 'var(--control-radius)' }}
        />
      </label>
      {title.trim() && (
        <label className="flex items-center gap-2 font-plex text-sm text-[var(--text)]">
          <input type="checkbox" checked={quoteOk} onChange={(e) => setQuoteOk(e.target.checked)} data-testid="mz-reply-quote" />
          You can quote me by this title
        </label>
      )}
      {error && <p className="font-plex text-sm text-[var(--accent-burgundy)]">{error}</p>}
      <button type="submit" disabled={state === 'sending' || !body.trim()} className={buttonClass} style={{ borderRadius: 'var(--control-radius)' }} data-testid="mz-reply-send">
        {state === 'sending' ? 'Sending…' : 'Send to Venkat'}
      </button>
    </form>
  );
};

const Note = ({ drop, isNew }) => (
  <article data-testid="mz-note" className="py-8 border-b border-[var(--rule)]">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
      <StatusChip status={drop.status} />
      <span className="font-plex text-sm text-[var(--text-label)]">{longDate(drop.created_at)}</span>
      {isNew && (
        <span data-testid="mz-new" className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)]">New</span>
      )}
      {drop.tags.map((tag) => (
        <span key={tag} className="font-plex text-sm text-[var(--text-muted)]">#{tag}</span>
      ))}
    </div>
    {drop.status === 'heard' && (
      <p data-testid="mz-unconfirmed" className="font-plex text-sm italic text-[var(--text-label)] mb-2">
        Unconfirmed. Someone told me this, and I haven't verified it yet.
      </p>
    )}
    <p className="font-editorial text-lg lg:text-xl leading-relaxed text-[var(--text)] whitespace-pre-line max-w-[65ch]">{drop.body}</p>
    {drop.story_url && (
      <p className="font-plex text-base mt-4">
        Now a story:{' '}
        {drop.story_url.startsWith('/') ? (
          <Link to={drop.story_url} className={linkClass}>{drop.story_title || 'Read it'}</Link>
        ) : (
          <a href={drop.story_url} className={linkClass}>{drop.story_title || 'Read it'}</a>
        )}
      </p>
    )}
    {drop.updates.length > 0 && (
      <div className="mt-5 space-y-4 border-l border-[var(--rule)] pl-4 max-w-[65ch]">
        {drop.updates.map((u) => (
          <div key={u.id} data-testid="mz-update">
            <p className="font-plex text-sm text-[var(--text-label)]">
              {shortDate(u.at)} · {u.credit ? `From a reader, ${u.credit}` : 'From a reader'}
            </p>
            <p className="font-plex text-base leading-relaxed text-[var(--text)] whitespace-pre-line">{u.body}</p>
          </div>
        ))}
      </div>
    )}
    {drop.history.length > 1 && (
      <p data-testid="mz-history" className="font-plex text-sm text-[var(--text-label)] mt-4">
        {drop.history.map((h) => `${STATUS_LABELS[h.status] || h.status} ${shortDate(h.at)}`).join(' · ')}
      </p>
    )}
    <ReplyBox dropId={drop.id} />
  </article>
);

/* The Mixed Zone: Venkat's short notes on what he has heard, for annual
   members (backend/mixed_zone.py). Replies go to him alone. Opening the
   page marks every note as seen, which clears the "new" count on the
   account page; notes posted since the previous visit carry a New label
   for this visit. */
export const MixedZoneMockup = () => {
  const { user, loading } = useAuth();
  const [state, setState] = useState('loading');
  const [drops, setDrops] = useState([]);
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setState('signed-out'); return; }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/mixed-zone`, { headers: authHeader() });
        if (!active) return;
        if (res.status === 401) { setState('signed-out'); return; }
        if (res.status === 403) { setState('not-annual'); return; }
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!active) return;
        setDrops(data.drops || []);
        setLastSeen(data.last_seen_at);
        setState('ready');
        fetch(`${API}/api/mixed-zone/seen`, { method: 'POST', headers: authHeader() }).catch(() => {});
      } catch (e) {
        if (active) setState('error');
      }
    })();
    return () => { active = false; };
  }, [user, loading]);

  const body = () => {
    if (state === 'loading') {
      return <p className="font-plex text-sm text-[var(--text-muted)]">Checking your membership…</p>;
    }
    if (state === 'signed-out') {
      return (
        <div data-testid="mz-gate-signed-out" className="space-y-4">
          <P>The Mixed Zone is for annual members.</P>
          <Link to="/login?next=/mixed-zone" className={buttonClass} style={{ borderRadius: 'var(--control-radius)' }}>Sign in</Link>
        </div>
      );
    }
    if (state === 'not-annual') {
      return (
        <div data-testid="mz-gate-not-annual">
          <P>
            The Mixed Zone is for annual members. Your plan doesn't include it.{' '}
            <Link to="/signup?ref=mixed-zone" className={linkClass}>See membership</Link>
          </P>
        </div>
      );
    }
    if (state === 'error') {
      return <P>The notes didn't load. Please refresh the page.</P>;
    }
    if (drops.length === 0) {
      return <p data-testid="mz-empty" className="font-plex text-base text-[var(--text-muted)] py-8">Nothing here yet. The first note is on its way.</p>;
    }
    const seen = lastSeen ? new Date(lastSeen) : null;
    return (
      <div className="border-t border-[var(--rule)]">
        {drops.map((d) => (
          <Note key={d.id} drop={d} isNew={!seen || new Date(d.created_at) > seen} />
        ))}
      </div>
    );
  };

  return (
    <MockupLayout
      testId="page-mixed-zone"
      hideFooterHeroCta
      seo={{ title: 'Mixed Zone', path: '/mixed-zone', description: 'Short notes from Venkat Ananth for annual members of The State of Play.', noindex: true }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Mixed Zone</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)]">For annual members</span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-16">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.75rem] leading-[1.1] mb-6">Mixed Zone</h1>
            <div className="max-w-[65ch] space-y-4 mb-10">
              <P>
                At a stadium, the mixed zone is the corridor where reporters catch players walking off after a game, before anything is official. This page is mine: short notes on what I've heard about the business of Indian sport, posted before they become stories.
              </P>
              <P>Each note carries a status, and I change it as the reporting moves. If you know something, reply under the note. Only I read replies.</P>
            </div>
            <div className="lg:hidden mb-8 pb-6 border-b border-[var(--rule)]">
              <StatusKey />
            </div>
            {body()}
          </div>
          <aside className="hidden lg:block lg:col-span-4 lg:pl-8 lg:border-l border-[var(--rule)]">
            <StatusKey />
          </aside>
        </div>
      </section>
    </MockupLayout>
  );
};

export default MixedZoneMockup;
