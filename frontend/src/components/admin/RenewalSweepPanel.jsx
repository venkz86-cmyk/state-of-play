import { useState } from 'react';
import { DataTable } from './DataTable';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

// The annual renewal sweep (annual_renewal.py), from the dashboard:
// Preview shows who would get what without sending anything; Send runs it
// for real. It's the same run the nightly cron does, and it never emails
// anyone twice for the same year, so sending here and then at night is safe.
const SWEEP = '/api/admin/annual-renewal/sweep';

const whenLabel = (days) => {
  if (days > 0) return `in ${Math.ceil(days)}d`;
  const ago = Math.floor(-days);
  return ago === 0 ? 'today' : `${ago}d ago`;
};

const columns = [
  {
    key: 'name', label: 'Name', sortable: true,
    render: (r) => (
      <>
        {r.name || '—'}
        {r.complimentary && <span className="text-[var(--text-muted)]"> · complimentary</span>}
      </>
    ),
  },
  { key: 'email', label: 'Email', sortable: true },
  {
    key: 'year_ends', label: 'Year ends', sortable: true, align: 'right',
    render: (r) => `${formatDate(r.year_ends)} (${whenLabel(r.days)})`,
  },
  {
    key: 'still_comped', label: 'Ghost', align: 'right',
    render: (r) => (r.still_comped ? 'Comped' : 'Free'),
  },
];

const Group = ({ title, note, rows, testId }) => (
  <div className="mb-10" data-testid={testId}>
    <p className="font-editorial italic text-lg mb-1">{title} ({rows.length})</p>
    <p className="font-plex text-[13px] text-[var(--text-muted)] mb-3 max-w-[70ch]">{note}</p>
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.email} emptyMessage="Nobody." />
  </div>
);

export const RenewalSweepPanel = ({ onAuthError }) => {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (dryRun) => {
    setBusy(true); setError('');
    try {
      const data = await adminFetch(`${SWEEP}?${dryRun ? 'dry_run=true' : 'details=true'}`, { method: 'POST' });
      setResult(data);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not run the renewal sweep.');
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const n = (result?.letter?.length || 0) + (result?.lapsed_note?.length || 0);
    const d = result?.downgrade?.length || 0;
    if (!window.confirm(`Send ${n} renewal email${n === 1 ? '' : 's'} and remove paid labels from ${d} ${d === 1 ? 'person' : 'people'} now?`)) return;
    run(false);
  };

  const groups = result && (
    <>
      <Group
        testId="sweep-letter" title="Renewal letter" rows={result.letter || []}
        note="Your letter, “A second year of The State of Play”, with their personal renewal link. Goes to anyone whose year ends in the next 14 days, and to anyone in their grace week who never got it."
      />
      <Group
        testId="sweep-lapsed" title="Short lapsed note" rows={result.lapsed_note || []}
        note="“Your membership has lapsed”, for anyone whose year has ended who already had the letter. Seven days to renew."
      />
      <Group
        testId="sweep-downgrade" title="Paid labels removed" rows={result.downgrade || []}
        note="More than seven days past the end of their year. Anyone still comped in Ghost keeps reading until you remove the comp."
      />
    </>
  );

  return (
    <div>
      <p className="font-plex text-[13px] text-[var(--text-muted)] mb-5 max-w-[70ch]">
        The same run as the nightly renewal sweep (4:10am IST). Preview first: it sends nothing. Nobody gets the
        same email twice for the same year, so sending now and letting tonight&rsquo;s run go ahead is safe.
      </p>
      <div className="flex flex-wrap items-center gap-4 border-y border-[var(--rule)] py-5 mb-8">
        <button
          type="button" disabled={busy} onClick={() => run(true)} data-testid="sweep-preview"
          className="inline-flex items-center justify-center border border-[var(--text)] font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 disabled:opacity-50"
        >
          Preview
        </button>
        {result?.dry_run && (
          <button
            type="button" disabled={busy} onClick={send} data-testid="sweep-send"
            className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 disabled:opacity-50"
          >
            Send now
          </button>
        )}
        {busy && <span className="font-plex text-[13px] text-[var(--text-muted)]">Working…</span>}
        {error && <span className="font-plex text-[13px] text-[var(--accent-burgundy)]">{error}</span>}
      </div>
      {result && (
        <p data-testid="sweep-summary" className="font-plex text-[14px] text-[var(--text)] mb-6">
          {result.dry_run ? 'Preview, nothing sent: ' : 'Done: '}
          {result.reminded} renewal letter{result.reminded === 1 ? '' : 's'}, {result.grace_started} lapsed
          note{result.grace_started === 1 ? '' : 's'}, {result.downgraded} label removal{result.downgraded === 1 ? '' : 's'}
          {result.downgraded_still_comped ? ` (${result.downgraded_still_comped} still comped)` : ''}.
          {' '}{result.checked} annual member{result.checked === 1 ? '' : 's'} checked.
        </p>
      )}
      {groups}
    </div>
  );
};

export default RenewalSweepPanel;
