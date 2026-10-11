import { useCallback, useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

// Tools → Group story links (backend group_links.py): one paid story for a
// WhatsApp group, read in full after an email code, with a first-year offer
// at ₹2,949 until the link's last day.

const label = 'font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';
const field = 'bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[14px] py-1 focus:outline-none focus:border-[var(--accent-burgundy)]';
const primary = 'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 disabled:opacity-50';
const quiet = 'font-plex text-[13px] text-[var(--accent-ink)] underline underline-offset-4 hover:text-[var(--text)] disabled:opacity-50';
const STATE = { open: 'Open', expired: 'Ended', closed: 'Closed' };

const CopyButton = ({ text, children, testId }) => {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={quiet} data-testid={testId}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { window.prompt('Copy this:', text); }
      }}>
      {done ? 'Copied' : children}
    </button>
  );
};

const Readers = ({ code, onAuthError }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    adminFetch(`/api/admin/group-links/${code}/readers`)
      .then((d) => setRows(d.readers))
      .catch((e) => { if (e instanceof AdminAuthError) onAuthError?.(); else setRows([]); });
  }, [code, onAuthError]);
  if (!rows) return <p className="font-plex text-[13px] text-[var(--text-muted)] py-2">Loading…</p>;
  if (rows.length === 0) return <p className="font-plex text-[13px] text-[var(--text-muted)] py-2">Nobody has read it yet.</p>;
  return (
    <ul className="py-2" data-testid={`group-readers-${code}`}>
      {rows.map((r) => (
        <li key={r.email} className="font-plex text-[13px] flex justify-between gap-4 py-1">
          <span>{r.email}{r.new_member && <span className="text-[var(--text-muted)]"> · new</span>}{r.joined && <span className="text-[var(--accent-ink)]"> · joined</span>}</span>
          <span className="text-[var(--text-muted)]">{formatDateTime(r.first_read_at)}</span>
        </li>
      ))}
    </ul>
  );
};

export const GroupLinksPanel = ({ onAuthError }) => {
  const [links, setLinks] = useState(null);
  const [story, setStory] = useState('');
  const [group, setGroup] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try { setLinks((await adminFetch('/api/admin/group-links')).links); }
    catch (e) { if (e instanceof AdminAuthError) onAuthError?.(); else setError(e.message || 'Could not load links.'); }
  }, [onAuthError]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setMade(null);
    try {
      const link = await adminFetch('/api/admin/group-links', {
        method: 'POST', body: JSON.stringify({ story: story.trim(), group_name: group.trim(), days: Number(days) }),
      });
      setMade(link); setStory(''); setGroup(''); setDays(3);
      load();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Could not create the link.');
    } finally {
      setBusy(false);
    }
  };

  const close = async (code) => {
    if (!window.confirm('Close this link now? The story and the offer stop working for everyone.')) return;
    try { await adminFetch(`/api/admin/group-links/${code}/close`, { method: 'POST' }); load(); }
    catch (e) { if (e instanceof AdminAuthError) onAuthError?.(); }
  };

  const remove = async (l) => {
    const read = l.readers ? ` ${l.readers} ${l.readers === 1 ? 'person has' : 'people have'} read it, and that record goes too.` : '';
    if (!window.confirm(`Delete this link?${read} The link stops working for anyone who has it. You can make a new one any time.`)) return;
    try {
      await adminFetch(`/api/admin/group-links/${l.code}`, { method: 'DELETE' });
      if (made?.code === l.code) setMade(null);
      load();
    } catch (e) { if (e instanceof AdminAuthError) onAuthError?.(); else setError(e.message || 'Could not delete the link.'); }
  };

  return (
    <div className="max-w-[900px]">
      <form onSubmit={create} className="mb-4" data-testid="group-create">
        <div className="flex flex-wrap items-end gap-6">
          <label>
            <span className={label}>Story link</span>
            <input value={story} onChange={(e) => setStory(e.target.value)} required placeholder="stateofplay.club/the-story"
              className={`${field} block mt-1 w-[300px]`} data-testid="group-story-input" />
          </label>
          <label>
            <span className={label}>Group name (readers see this)</span>
            <input value={group} onChange={(e) => setGroup(e.target.value)} required placeholder="Sports Business India"
              className={`${field} block mt-1 w-[240px]`} data-testid="group-name-input" />
          </label>
          <label>
            <span className={label}>Open for</span>
            <select value={days} onChange={(e) => setDays(e.target.value)} className={`${field} block mt-1`} data-testid="group-days">
              {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <button type="submit" className={primary} disabled={busy} data-testid="group-create-submit">{busy ? 'Making…' : 'Make the link'}</button>
        </div>
      </form>
      <p className="font-plex text-[13px] text-[var(--text-muted)] mb-8 max-w-[72ch]">
        Readers enter their email and a 6-digit code to read the story in full, so a forwarded link still tells you who read
        it. The end of the story offers the first year at ₹2,949 ($120 outside India) until the last day.
      </p>
      {error && <p className="font-plex text-[13px] text-[var(--accent-ink)] mb-6">{error}</p>}
      {made && (
        <div className="border border-[var(--text)] p-5 mb-10" data-testid="group-made">
          <p className="font-plex text-[14px] mb-1">Ready for {made.group_name}, open until {made.last_day}:</p>
          <p className="font-plex text-[15px] mb-3 break-all">{made.url}</p>
          <div className="flex flex-wrap gap-5">
            <CopyButton text={made.url} testId="group-copy-link">Copy link</CopyButton>
            <CopyButton text={made.whatsapp_text} testId="group-copy-message">Copy WhatsApp message</CopyButton>
          </div>
          <p className="font-plex text-[13px] text-[var(--text-muted)] mt-3">Message: {made.whatsapp_text}</p>
        </div>
      )}

      <p className={`${label} mb-3`}>Your group links</p>
      {!links ? (
        <p className="font-plex text-[13px] text-[var(--text-muted)]">Loading…</p>
      ) : links.length === 0 ? (
        <p className="font-plex text-[13px] text-[var(--text-muted)]">None yet.</p>
      ) : (
        <ul data-testid="group-links">
          {links.map((l) => (
            <li key={l.code} className="border-b border-[var(--rule)] py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div>
                  <p className="font-plex text-[14px]">{l.group_name} <span className="text-[var(--text-muted)]">· {l.title}</span></p>
                  <p className="font-plex text-[13px] text-[var(--text-muted)]">
                    {STATE[l.state] || l.state}{l.state === 'open' ? ` until ${l.last_day}` : ''} · {l.readers} read · {l.new_members} new · {l.joined} joined
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button type="button" className={quiet} onClick={() => setOpen(open === l.code ? null : l.code)}>{open === l.code ? 'Hide readers' : 'Readers'}</button>
                  {l.state === 'open' && <CopyButton text={l.url}>Copy link</CopyButton>}
                  {l.state === 'open' && <button type="button" className={quiet} onClick={() => close(l.code)}>Close</button>}
                  <button type="button" className={quiet} onClick={() => remove(l)} data-testid={`group-delete-${l.code}`}>Delete</button>
                </div>
              </div>
              {open === l.code && <Readers code={l.code} onAuthError={onAuthError} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GroupLinksPanel;
