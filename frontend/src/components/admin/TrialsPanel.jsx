import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

export const TrialsPanel = ({ onAuthError }) => {
  const [trials, setTrials] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await adminFetch('/api/admin/trials');
        if (active) setTrials(data.trials);
      } catch (e) {
        if (e instanceof AdminAuthError) { onAuthError?.(); return; }
        if (active) setError(e.message || 'Could not load trials.');
      }
    })();
    return () => { active = false; };
  }, [onAuthError]);

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
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-8">
        <KPITile label="Active trials" value={activeCount} />
        <KPITile label="Total ever" value={trials.length} bordered />
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
