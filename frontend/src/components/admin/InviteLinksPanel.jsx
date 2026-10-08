import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

// Private invite links (backend invite_links.py): a first year at
// ₹2,499 + GST / $120 for someone you know, or everyone at an event.
// With an email, the link works once for that address and is emailed
// to them. Without one, it's an event link: share it or show the QR.
const field = 'w-full bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[15px] py-2 focus:outline-none focus:border-[var(--accent-burgundy)]';
const label = 'block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';
const quiet = 'font-plex text-[13px] text-[var(--accent)] underline underline-offset-[5px] decoration-1 hover:decoration-2 disabled:opacity-50';
const STATE_TEXT = { open: 'Open', full: 'Used up', expired: 'Past its last day', closed: 'Closed' };
const STATE_TONE = { open: 'var(--text)', full: 'var(--text-muted)', expired: 'var(--text-muted)', closed: 'var(--text-muted)' };

const QR = ({ invite }) => {
  const box = useRef(null);
  const download = () => {
    const canvas = box.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `tsop-invite-${invite.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || invite.code}.png`;
    a.click();
  };
  return (
    <div className="flex items-end gap-4">
      <div ref={box} className="bg-white p-2 border border-[var(--rule)]">
        <QRCodeCanvas value={invite.url} size={512} level="M" style={{ width: 112, height: 112 }} />
      </div>
      <button type="button" className={quiet} onClick={download} data-testid="invite-qr-download">Download QR</button>
    </div>
  );
};

const InviteRow = ({ invite, onClose, onRefresh }) => {
  const [copied, setCopied] = useState(false);
  const [showUses, setShowUses] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(invite.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_e) { /* ignore */ }
  };
  const cap = invite.max_uses ? `${invite.used} of ${invite.max_uses} used` : `${invite.used} used`;
  return (
    <li data-testid="invite-row" className="py-6 border-b border-[var(--rule)] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5">
      <div className="min-w-0">
        <p className="font-plex text-[16px] font-medium text-[var(--text)]">{invite.name}</p>
        <p className="font-plex text-[13px] text-[var(--text-muted)] mt-1">
          <span style={{ color: STATE_TONE[invite.state] }}>{STATE_TEXT[invite.state] || invite.state}</span>
          {' · '}{cap}
          {invite.expires_at ? ` · last day ${formatDate(new Date(new Date(invite.expires_at).getTime() - 1000).toISOString())}` : ''}
          {invite.email ? ` · for ${invite.email}${invite.email_sent === false ? ' (email didn’t send; copy the link to them)' : ', emailed'}` : ''}
        </p>
        <p className="font-plex text-[13px] text-[var(--text-label)] mt-2 break-all">{invite.url}</p>
        <div className="flex flex-wrap gap-5 mt-3">
          <button type="button" className={quiet} onClick={copy} data-testid="invite-copy">{copied ? 'Copied' : 'Copy link'}</button>
          {invite.used > 0 && (
            <button type="button" className={quiet} onClick={() => setShowUses(!showUses)}>{showUses ? 'Hide who joined' : 'Who joined'}</button>
          )}
          {invite.state === 'open' && !invite.email && (
            <button type="button" className={quiet} onClick={() => onRefresh(invite)} data-testid="invite-refresh">New link and QR</button>
          )}
          {invite.state === 'open' && (
            <button type="button" className={quiet} onClick={() => onClose(invite)} data-testid="invite-close">Close link</button>
          )}
        </div>
        {showUses && (
          <ul className="mt-3 space-y-1">
            {invite.uses.map((u) => (
              <li key={`${u.email}-${u.at}`} className="font-plex text-[13px] text-[var(--text-muted)]">{u.email} · {formatDate(u.at)}</li>
            ))}
          </ul>
        )}
      </div>
      {!invite.email && invite.state === 'open' && <QR invite={invite} />}
    </li>
  );
};

export const InviteLinksPanel = ({ onAuthError }) => {
  const [invites, setInvites] = useState(null);
  const [kind, setKind] = useState('person');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState(null);

  const call = async (path, options) => {
    try {
      return await adminFetch(path, options);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return null; }
      throw e;
    }
  };
  const load = async () => {
    try {
      const data = await call('/api/admin/invites');
      if (data) setInvites(data.invites);
    } catch (e) { setError(e.message || 'Could not load the links.'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setMade(null);
    try {
      const body = { name: name.trim(), last_day: lastDay || null };
      if (kind === 'person') {
        if (email.trim()) { body.email = email.trim(); body.note = note.trim(); } else { body.max_uses = 1; }
      } else if (maxUses) {
        body.max_uses = Number(maxUses);
      }
      const data = await call('/api/admin/invites', { method: 'POST', body: JSON.stringify(body) });
      if (data) {
        setMade(data);
        setName(''); setEmail(''); setNote(''); setMaxUses(''); setLastDay('');
        await load();
      }
    } catch (err) {
      setError(err.message || 'Could not make the link.');
    } finally {
      setBusy(false);
    }
  };

  const close = async (invite) => {
    if (!window.confirm(`Close the link “${invite.name}”? Anyone who opens it after this sees the regular price.`)) return;
    try { await call(`/api/admin/invites/${invite.code}/close`, { method: 'POST' }); await load(); } catch (e) { setError(e.message); }
  };

  const refresh = async (invite) => {
    if (!window.confirm(`Make a new link and QR for “${invite.name}”? The current link and QR stop working straight away.`)) return;
    try { await call(`/api/admin/invites/${invite.code}/refresh`, { method: 'POST' }); await load(); } catch (e) { setError(e.message); }
  };

  const tab = (value, text) => (
    <button
      type="button" onClick={() => setKind(value)} aria-pressed={kind === value} data-testid={`invite-kind-${value}`}
      className={`font-plex text-[13px] px-4 h-9 border transition-colors ${
        kind === value ? 'border-[var(--accent-burgundy)] text-[var(--accent-burgundy)]' : 'border-[var(--rule)] text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div>
      <form onSubmit={create} data-testid="invite-form" className="max-w-[640px] mb-12 space-y-6">
        <div className="flex flex-wrap gap-2">
          {tab('person', 'For one person')}
          {tab('event', 'For an event')}
        </div>
        <label className={label}>
          {kind === 'person' ? 'Their name' : 'Event'}
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120}
            placeholder={kind === 'person' ? 'Their full name' : 'Name of the event'}
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="invite-name" />
        </label>
        {kind === 'person' ? (
          <>
            <label className={label}>
              Their email (optional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Leave empty to send the link yourself"
                className={`${field} mt-1 normal-case tracking-normal`} data-testid="invite-email" />
            </label>
            {email.trim() && (
              <label className={label}>
                A line from you (optional)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400}
                  placeholder="Goes at the top of the email, after their name."
                  className={`${field} mt-1 normal-case tracking-normal resize-y`} data-testid="invite-note" />
              </label>
            )}
          </>
        ) : (
          <label className={label}>
            How many people can use it (optional)
            <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="No limit"
              className={`${field} mt-1 normal-case tracking-normal`} data-testid="invite-max" />
          </label>
        )}
        <label className={label}>
          Last day (optional)
          <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)}
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="invite-last-day" />
        </label>
        <p className="font-plex text-[13px] text-[var(--text-muted)]">
          {kind === 'person'
            ? (email.trim()
              ? 'The link works once, for this email only, and goes to them now with your line.'
              : 'The link works once. Copy it and send it yourself.')
            : 'Anyone with the link or the QR code can use it until it’s used up or past its last day.'}
          {' '}It’s a first year at ₹2,499 + GST, or $120 outside India.
        </p>
        <button type="submit" disabled={busy || !name.trim()} data-testid="invite-submit"
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-11 px-6 disabled:opacity-50">
          {busy ? 'Making…' : (kind === 'person' && email.trim() ? 'Make and email the link' : 'Make the link')}
        </button>
        {error && <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>}
        {made && (
          <p data-testid="invite-made" className="font-plex text-[14px]">
            Done. {made.email ? (made.email_sent ? `The link is on its way to ${made.email}.` : 'The email didn’t send; copy the link below and send it yourself.') : 'The link is at the top of the list below.'}
          </p>
        )}
      </form>

      <p className="section-label text-[var(--text-label)] block mb-1">Links</p>
      {invites === null ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>
      ) : invites.length === 0 ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)]">No links yet.</p>
      ) : (
        <ul className="border-t border-[var(--rule)]">
          {invites.map((i) => <InviteRow key={i.code} invite={i} onClose={close} onRefresh={refresh} />)}
        </ul>
      )}
    </div>
  );
};

export default InviteLinksPanel;
