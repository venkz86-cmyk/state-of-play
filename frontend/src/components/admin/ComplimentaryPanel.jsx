import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

// Complimentary years (backend complimentary.py): give one, and see who
// has one. The year-end letter and renewal offer run on their own with
// the nightly renewal run.
const STATUS_TONE = {
  active: 'var(--text)', 'ending soon': 'var(--accent-burgundy)',
  renewed: 'var(--accent-blue)', ended: 'var(--text-muted)',
};

const columns = [
  { key: 'name', label: 'Name', sortable: true, render: (r) => r.name || '—' },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'ends_at', label: 'Year ends', sortable: true, align: 'right', render: (r) => formatDate(r.ends_at) },
  {
    key: 'status', label: 'Status', sortable: true,
    render: (r) => <span style={{ color: STATUS_TONE[r.status] }}>{r.status}</span>,
  },
  { key: 'ghost_comp', label: 'Ghost comp', render: (r) => (r.ghost_comp ? 'Set' : 'By hand') },
];

export const ComplimentaryPanel = ({ onAuthError }) => {
  const [grants, setGrants] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await adminFetch('/api/admin/complimentary');
      setGrants(data.grants);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load complimentary years.');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const give = async (e) => {
    e.preventDefault();
    const who = name.trim() || email.trim();
    if (!window.confirm(`Give ${who} a year of The State of Play and send them your note?`)) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await adminFetch('/api/admin/complimentary', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), note: note.trim() }),
      });
      setResult(data);
      setName(''); setEmail(''); setNote('');
      await load();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Could not give the year.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[15px] py-2 focus:outline-none focus:border-[var(--accent-burgundy)]';
  const label = 'block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';

  return (
    <div>
      <form onSubmit={give} data-testid="comp-form" className="max-w-[640px] mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <label className={label}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their full name"
              className={`${field} mt-1 normal-case tracking-normal`} data-testid="comp-name" />
          </label>
          <label className={label}>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com"
              className={`${field} mt-1 normal-case tracking-normal`} data-testid="comp-email" />
          </label>
        </div>
        <label className={`${label} mb-6`}>
          A line from you (optional)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400}
            placeholder="Goes into the note, after the first paragraph."
            className={`${field} mt-1 normal-case tracking-normal resize-y`} data-testid="comp-note" />
        </label>
        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-5">
          They can read everything straight away, for 365 days. If they already have a complimentary year, this adds
          a year to it.
        </p>
        <button type="submit" disabled={busy} data-testid="comp-submit"
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-11 px-6 disabled:opacity-50">
          {busy ? 'Giving…' : 'Give a year'}
        </button>
        {error && <p className="font-plex text-[14px] text-[var(--accent-burgundy)] mt-4">{error}</p>}
        {result && (
          <div data-testid="comp-result" className="font-plex text-[14px] mt-4 space-y-1">
            <p>
              Done. {result.name || result.email} reads until {formatDate(result.ends_at)}
              {result.extended ? ', a year added to the one they had' : ''}.
              {' '}{result.email_sent ? 'Your note is on its way.' : 'The note didn’t send; it’s listed on Today.'}
            </p>
            {!result.ghost_comp && (
              <p className="text-[var(--accent-burgundy)]">
                Ghost’s own comp couldn’t be set. They can read everything on the site already; comp them in Ghost
                by hand until {formatDate(result.ends_at)} so Ghost’s paid list is right.
              </p>
            )}
          </div>
        )}
      </form>

      <p className="section-label text-[var(--text-label)] block mb-3">Complimentary years</p>
      {grants === null ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={grants} rowKey={(r) => r.email} emptyMessage="None given yet." />
      )}
      <p className="font-plex text-[13px] text-[var(--text-muted)] mt-4 max-w-[64ch]">
        Fourteen days before a year ends they get a note with the ₹2,999 renewal offer, then the lapsed note on the
        day. A week later their access ends, unless they’ve renewed.
      </p>
    </div>
  );
};

export default ComplimentaryPanel;
