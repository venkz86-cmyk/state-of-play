import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';
import { STATUS_LABELS, StatusChip } from '../../pages/MixedZoneMockup';

// The Mixed Zone (backend mixed_zone.py): post a note, move its status
// as the reporting goes, read the private replies and post one under the
// note as an update. Nothing here emails anyone.
const STATUSES = ['heard', 'checking', 'confirmed', 'didnt_hold'];

const field = 'w-full bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[15px] py-2 focus:outline-none focus:border-[var(--accent-burgundy)]';
const label = 'block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';
const primary = 'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 disabled:opacity-50';
const quiet = 'font-plex text-[13px] text-[var(--accent)] underline underline-offset-[5px] decoration-1 hover:decoration-2 disabled:opacity-50';

const parseTags = (text) => text.split(',').map((t) => t.trim()).filter(Boolean);

const StatusPicker = ({ value, onChange, testId }) => (
  <div className="flex flex-wrap gap-2" data-testid={testId}>
    {STATUSES.map((s) => (
      <button
        key={s} type="button" onClick={() => onChange(s)} aria-pressed={value === s}
        data-testid={`${testId}-${s}`}
        className={`font-plex text-[13px] px-3 h-8 border transition-colors ${
          value === s
            ? 'border-[var(--accent-burgundy)] text-[var(--accent-burgundy)]'
            : 'border-[var(--rule)] text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        {STATUS_LABELS[s]}
      </button>
    ))}
  </div>
);

const NoteCard = ({ drop, call, reload }) => {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(drop.body);
  const [tags, setTags] = useState(drop.tags.join(', '));
  const [storyUrl, setStoryUrl] = useState(drop.story_url);
  const [storyTitle, setStoryTitle] = useState(drop.story_title);
  const [replies, setReplies] = useState(null);
  const [update, setUpdate] = useState({ body: '', credit: '', reply_id: null });
  const [busy, setBusy] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const patch = (changes) => run(async () => {
    await call(`/api/admin/mixed-zone/${drop.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    await reload();
  });
  const loadReplies = () => run(async () => {
    const data = await call(`/api/admin/mixed-zone/${drop.id}/replies`);
    if (data) setReplies(data);
    await reload();
  });
  const postUpdate = (e) => {
    e.preventDefault();
    run(async () => {
      await call(`/api/admin/mixed-zone/${drop.id}/updates`, { method: 'POST', body: JSON.stringify(update) });
      setUpdate({ body: '', credit: '', reply_id: null });
      setUpdateOpen(false);
      if (replies) setReplies(await call(`/api/admin/mixed-zone/${drop.id}/replies`));
      await reload();
    });
  };
  const pickReply = (r) => { setUpdate({ body: r.body, credit: r.quote_ok ? r.title : '', reply_id: r.id }); setUpdateOpen(true); };

  return (
    <article data-testid="mz-admin-note" className="py-6 border-b border-[var(--rule)]">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <StatusChip status={drop.status} />
        <span className="font-plex text-[13px] text-[var(--text-label)]">{formatDate(drop.created_at)}</span>
        {drop.tags.map((t) => <span key={t} className="font-plex text-[13px] text-[var(--text-muted)]">#{t}</span>)}
        {drop.unread > 0 && (
          <span data-testid="mz-admin-unread" className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)]">
            {drop.unread} new {drop.unread === 1 ? 'reply' : 'replies'}
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-4 max-w-[640px] mb-4">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1500} className={`${field} resize-y`} />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, separated by commas" className={field} />
          <div className="flex gap-4">
            <button type="button" disabled={busy} className={primary}
              onClick={() => patch({ body, tags: parseTags(tags) }).then(() => setEditing(false))}>Save</button>
            <button type="button" className={quiet} onClick={() => { setEditing(false); setBody(drop.body); setTags(drop.tags.join(', ')); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <p className="font-plex text-[15px] leading-relaxed whitespace-pre-line max-w-[70ch] mb-4">{drop.body}</p>
      )}

      <div className="mb-4">
        <p className={`${label} mb-2`}>Status</p>
        <StatusPicker value={drop.status} onChange={(s) => s !== drop.status && patch({ status: s })} testId={`mz-admin-status-${drop.id}`} />
        {drop.history.length > 1 && (
          <p className="font-plex text-[13px] text-[var(--text-muted)] mt-2">
            {drop.history.map((h) => `${STATUS_LABELS[h.status]} ${formatDate(h.at)}`).join(' · ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_auto] gap-4 items-end max-w-[760px] mb-4">
        <label className={label}>
          Story link
          <input value={storyUrl} onChange={(e) => setStoryUrl(e.target.value)} placeholder="/the-story-slug or https://…" className={`${field} mt-1 normal-case tracking-normal`} />
        </label>
        <label className={label}>
          Story title
          <input value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} placeholder="As it appears on the site" className={`${field} mt-1 normal-case tracking-normal`} />
        </label>
        <button type="button" disabled={busy || (storyUrl === drop.story_url && storyTitle === drop.story_title)} className={quiet}
          onClick={() => patch({ story_url: storyUrl, story_title: storyTitle })}>Save link</button>
      </div>

      {drop.updates.length > 0 && (
        <div className="border-l border-[var(--rule)] pl-4 mb-4 space-y-3 max-w-[70ch]">
          {drop.updates.map((u) => (
            <div key={u.id}>
              <p className="font-plex text-[13px] text-[var(--text-label)]">
                {formatDate(u.at)} · {u.credit ? `From a reader, ${u.credit}` : 'From a reader'}
                {' · '}
                <button type="button" className={quiet} disabled={busy}
                  onClick={() => window.confirm('Remove this update from the page?') && run(async () => {
                    await call(`/api/admin/mixed-zone/${drop.id}/updates/${u.id}`, { method: 'DELETE' });
                    await reload();
                  })}>Remove</button>
              </p>
              <p className="font-plex text-[15px] whitespace-pre-line">{u.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-5 mb-2">
        <button type="button" className={quiet} disabled={busy} onClick={replies ? () => setReplies(null) : loadReplies} data-testid="mz-admin-replies">
          {replies ? 'Hide replies' : `Replies (${drop.replies})`}
        </button>
        {!updateOpen && <button type="button" className={quiet} onClick={() => setUpdateOpen(true)} data-testid="mz-admin-add-update">Add an update</button>}
        {!editing && <button type="button" className={quiet} onClick={() => setEditing(true)}>Edit note</button>}
        <button type="button" className={quiet} disabled={busy}
          onClick={() => window.confirm('Delete this note and every reply to it? This cannot be undone.') && run(async () => {
            await call(`/api/admin/mixed-zone/${drop.id}`, { method: 'DELETE' });
            await reload();
          })}>Delete note</button>
      </div>

      {replies && (
        <div className="mt-4 space-y-4 max-w-[70ch]" data-testid="mz-admin-reply-list">
          {replies.length === 0 && <p className="font-plex text-[14px] text-[var(--text-muted)]">No replies yet.</p>}
          {replies.map((r) => (
            <div key={r.id} className="bg-[var(--surface)] p-4">
              <p className="font-plex text-[13px] text-[var(--text-label)] mb-1">
                {r.name || r.email} · {r.email}{r.title ? ` · ${r.title}` : ''} · {formatDate(r.created_at)}
              </p>
              <p className="font-plex text-[15px] whitespace-pre-line mb-2">{r.body}</p>
              <p className="font-plex text-[13px] text-[var(--text-muted)]">
                {r.quote_ok ? 'OK to quote by title.' : 'Not to be quoted by title.'}
                {r.posted ? ' Posted as an update.' : ''}
                {' '}
                <button type="button" className={quiet} onClick={() => pickReply(r)} data-testid="mz-admin-use-reply">Post as an update</button>
              </p>
            </div>
          ))}
        </div>
      )}

      {updateOpen && <form onSubmit={postUpdate} className="mt-5 max-w-[640px] space-y-3">
        <p className={label}>Add an update</p>
        <textarea value={update.body} onChange={(e) => setUpdate({ ...update, body: e.target.value })} rows={3} maxLength={2000}
          placeholder="Shown under the note. Edit a reader's words before posting if you need to." className={`${field} resize-y`} data-testid="mz-admin-update-body" />
        <input value={update.credit} onChange={(e) => setUpdate({ ...update, credit: e.target.value })} maxLength={120}
          placeholder="Credit, e.g. Banker, Mumbai. Leave empty for 'From a reader'." className={field} data-testid="mz-admin-update-credit" />
        <div className="flex gap-4 items-center">
          <button type="submit" disabled={busy || !update.body.trim()} className={primary}>Post update</button>
          <button type="button" className={quiet} onClick={() => { setUpdateOpen(false); setUpdate({ body: '', credit: '', reply_id: null }); }}>Cancel</button>
        </div>
      </form>}
    </article>
  );
};

export const MixedZonePanel = ({ onAuthError }) => {
  const [drops, setDrops] = useState(null);
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('heard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const call = async (path, options) => {
    try {
      setError('');
      return await adminFetch(path, options);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return null; }
      setError(e.message || 'That did not work.');
      throw e;
    }
  };
  const load = async () => {
    const data = await call('/api/admin/mixed-zone').catch(() => null);
    if (data) setDrops(data.drops);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('/api/admin/mixed-zone', { method: 'POST', body: JSON.stringify({ body, tags: parseTags(tags), status }) });
      setBody(''); setTags(''); setStatus('heard');
      await load();
    } catch (_e) { /* shown via error */ } finally {
      setBusy(false);
    }
  };
  const safeCall = (path, options) => call(path, options).catch(() => null);

  return (
    <div>
      <form onSubmit={post} data-testid="mz-admin-form" className="max-w-[640px] mb-12 space-y-5">
        <label className={label}>
          The note
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1500} required
            placeholder="What you heard, in a few lines."
            className={`${field} mt-1 normal-case tracking-normal resize-y`} data-testid="mz-admin-body" />
        </label>
        <label className={label}>
          Tags (optional)
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="RCB, BCCI"
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="mz-admin-tags" />
        </label>
        <div>
          <p className={`${label} mb-2`}>Status</p>
          <StatusPicker value={status} onChange={setStatus} testId="mz-admin-new-status" />
        </div>
        <p className="font-plex text-[13px] text-[var(--text-muted)]">
          Heard notes show a line saying they are unconfirmed. Members-only is still publishing, so keep allegations
          against named people out until a note is confirmed.
        </p>
        <button type="submit" disabled={busy || !body.trim()} className={primary} data-testid="mz-admin-post">
          {busy ? 'Posting…' : 'Post note'}
        </button>
        {error && <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>}
      </form>

      <p className="section-label text-[var(--text-label)] block mb-1">Notes</p>
      {drops === null ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>
      ) : drops.length === 0 ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)]">No notes yet.</p>
      ) : (
        <div className="border-t border-[var(--rule)]">
          {drops.map((d) => <NoteCard key={d.id} drop={d} call={safeCall} reload={load} />)}
        </div>
      )}
    </div>
  );
};

export default MixedZonePanel;
