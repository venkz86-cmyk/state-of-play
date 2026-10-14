import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

/* Today: phone notifications for new stories (backend push.py). How many
   phones have them on, the last story sent, a pause switch, a test send
   to your own phone, and the notification line for each scheduled or
   draft story (written before publishing; without one, the dek goes). */

const LineRow = ({ post, max, onAuthError }) => {
  const [line, setLine] = useState(post.line);
  const [saved, setSaved] = useState(post.line);
  const [state, setState] = useState('');
  const save = async () => {
    setState('Saving…');
    try {
      const r = await adminFetch('/api/admin/push/line', { method: 'POST', body: JSON.stringify({ post_id: post.id, line, title: post.title }) });
      setSaved(r.line); setLine(r.line); setState('Saved');
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setState(e.message || 'Not saved');
    }
  };
  const shown = line.trim() || post.excerpt;
  return (
    <li className="border-t border-[var(--rule)] py-4" data-testid="push-line-row">
      <p className="font-plex text-[14px] font-medium">{post.title || 'Untitled'}</p>
      <p className="font-plex text-[12px] text-[var(--text-muted)] mt-0.5">
        {post.status === 'scheduled' ? `Scheduled for ${formatDateTime(post.scheduled_for)}` : 'Draft'}
      </p>
      <textarea
        value={line}
        onChange={(e) => { setLine(e.target.value.slice(0, max)); setState(''); }}
        rows={2}
        maxLength={max}
        placeholder={post.excerpt ? `Empty: the dek goes out (“${post.excerpt.slice(0, 60)}…”)` : 'Empty: only the headline goes out'}
        className="mt-2 w-full border border-[var(--rule)] bg-transparent p-2.5 font-plex text-[14px] leading-snug focus:outline-none focus:border-[var(--text)]"
        data-testid="push-line-input"
      />
      <div className="flex items-center justify-between gap-4 mt-1.5">
        <span className="font-plex text-[12px] text-[var(--text-muted)] tabular-nums">{line.length}/{max}</span>
        <span className="flex items-center gap-4">
          {state && <span className="font-plex text-[12px] text-[var(--text-muted)]" role="status">{state}</span>}
          <button type="button" onClick={save} disabled={line === saved} data-testid="push-line-save"
            className="font-plex text-[13px] underline underline-offset-4 disabled:opacity-40 disabled:no-underline">Save</button>
        </span>
      </div>
      {/* how it reads on a lock screen */}
      <div className="mt-3 flex gap-2.5 rounded-[14px] bg-[var(--surface)] p-3 max-w-[360px]" aria-label="Preview">
        <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-[7px] shrink-0" />
        <div className="min-w-0">
          <p className="font-plex text-[13px] font-semibold leading-snug">{post.title || 'Untitled'}</p>
          {shown && <p className="font-plex text-[13px] leading-snug text-[var(--text-muted)]">{shown}</p>}
        </div>
      </div>
    </li>
  );
};

const NotificationLines = ({ onAuthError }) => {
  const [d, setD] = useState(null);
  useEffect(() => { adminFetch('/api/admin/push/upcoming').then(setD).catch(() => {}); }, []);
  if (!d || !d.posts.length) return null;
  return (
    <div className="mt-6" data-testid="push-lines">
      <p className="font-plex text-[13px] font-medium">Notification lines</p>
      <p className="font-plex text-[12px] text-[var(--text-muted)] mb-2">
        The line under the headline on a phone, up to {d.max} characters. Write it before you publish: the notification goes within 5 minutes.
      </p>
      <ul>{d.posts.map((p) => <LineRow key={p.id} post={p} max={d.max} onAuthError={onAuthError} />)}</ul>
    </div>
  );
};
export const PushPanel = ({ onAuthError, label }) => {
  const [s, setS] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (e) => {
    if (e instanceof AdminAuthError) { onAuthError?.(); return; }
    setNote(e.message || 'That didn’t work.');
  };
  useEffect(() => {
    adminFetch('/api/admin/push').then(setS).catch((e) => {
      if (e instanceof AdminAuthError) onAuthError?.();
      else setNote('Couldn’t load notifications. Refresh to try again.');
    });
  }, [onAuthError]);
  if (!s) return <p className="font-plex text-[14px] text-[var(--text-muted)]" role="status">{note || 'Loading…'}</p>;

  const togglePause = async () => {
    setBusy(true); setNote('');
    try {
      const r = await adminFetch('/api/admin/push/pause', { method: 'POST', body: JSON.stringify({ paused: !s.paused }) });
      setS({ ...s, paused: r.paused });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setNote('');
    try {
      const r = await adminFetch('/api/admin/push/test', { method: 'POST', body: JSON.stringify({}) });
      setNote(r.sent ? `Sent to ${r.sent} ${r.sent === 1 ? 'phone' : 'phones'} signed in as ${r.email}.` : 'It didn’t reach your phone. Turn notifications off and on again at /app.');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const link = 'font-plex text-[13px] text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] disabled:opacity-50';

  return (
    <section className="mb-10" data-testid="today-push">
      <p className={label}>Phone notifications</p>
      <p className="font-plex text-[14px]">
        {s.devices} {s.devices === 1 ? 'phone has' : 'phones have'} notifications on.
        {s.last ? ` Last sent: “${s.last.title}” to ${s.last.sent}, ${formatDateTime(s.last.at)}.` : ' Nothing sent yet.'}
        {s.paused && <span className="text-[var(--accent-ink)]"> Paused: new stories won’t send.</span>}
      </p>
      <div className="flex flex-wrap gap-5 mt-2">
        <button type="button" onClick={togglePause} disabled={busy} className={link} data-testid="push-pause">
          {s.paused ? 'Resume notifications' : 'Pause notifications'}
        </button>
        <button type="button" onClick={test} disabled={busy} className={link} data-testid="push-test">Send a test to my phone</button>
      </div>
      {note && <p className="font-plex text-[13px] mt-2" role="status">{note}</p>}
      <NotificationLines onAuthError={onAuthError} />
    </section>
  );
};

export default PushPanel;
