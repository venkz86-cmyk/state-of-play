import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

export const TrialsPanel = ({ onAuthError }) => {
  const [trials, setTrials] = useState(null);
  const [error, setError] = useState('');
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);

  const load = async () => {
    try {
      const data = await adminFetch('/api/admin/trials');
      setTrials(data.trials);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load trials.');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSweep = async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const result = await adminFetch('/api/trial/reminder-check', { method: 'POST', body: JSON.stringify({}) });
      setSweepResult(result);
      await load();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Reminder sweep failed.');
    } finally {
      setSweeping(false);
    }
  };

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!trials) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const activeCount = trials.filter((t) => !t.expired).length;

  const columns = [
    { key: 'email', label: 'Email', sortable: true },
    { key: 'snapshot_slugs', label: 'Stories', sortable: false, render: (t) => `${(t.snapshot_slugs || []).length} snapshotted` },
    { key: 'started_at', label: 'Started', sortable: true, render: (t) => formatDate(t.started_at) },
    {
      key: 'expires_at', label: 'Expires', sortable: true, align: 'right',
      render: (t) => (
        <span style={{ color: t.expired ? 'var(--accent-burgundy)' : 'var(--text)' }}>
          {formatDate(t.expires_at)}{t.expired ? ' (expired)' : t.days_left != null ? ` (${t.days_left}d)` : ''}
        </span>
      ),
    },
    {
      key: 'reminders', label: 'Reminders sent',
      render: (t) => [
        t.reminder_5day_sent && '5-day',
        t.reminder_winback_sent && 'winback',
      ].filter(Boolean).join(', ') || '—',
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-6">
        <KPITile label="Active trials" value={activeCount} />
        <KPITile label="Total ever" value={trials.length} bordered />
      </div>

      <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--rule)]">
        <div>
          <p className="font-plex text-[13px] text-[var(--text-muted)]">
            Sends the 5-days-left reminder and the 7-days-after winback email, once each per trial.
            Runs automatically once the daily Apps Script trigger is set up — this button is for
            testing, or running it by hand in the meantime.
          </p>
          {sweepResult && (
            <p className="font-plex text-[13px] text-[var(--text)] mt-2">
              {sweepResult.reminders_sent} reminder{sweepResult.reminders_sent === 1 ? '' : 's'} sent,{' '}
              {sweepResult.winbacks_sent} winback{sweepResult.winbacks_sent === 1 ? '' : 's'} sent.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={runSweep}
          disabled={sweeping}
          className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] underline underline-offset-4 hover:decoration-2 disabled:opacity-60 shrink-0 ml-6"
        >
          {sweeping ? 'Running…' : 'Run reminder sweep →'}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={trials}
        rowKey={(t) => t.email}
        searchKeys={['email']}
        searchPlaceholder="Search by email…"
        emptyMessage="No trial signups yet."
      />
    </div>
  );
};

export default TrialsPanel;
