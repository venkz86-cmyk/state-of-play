import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate, daysUntil } from '../../lib/format';

const FILTERS = ['active', 'expired', 'all'];

export const NominatedReadersPanel = ({ onAuthError }) => {
  const [filter, setFilter] = useState('active');
  const [grants, setGrants] = useState(null);
  const [error, setError] = useState('');
  const [busyEmail, setBusyEmail] = useState(null);

  const load = async (statusFilter) => {
    try {
      const data = await adminFetch(`/api/admin/nominations/access?status_filter=${statusFilter}`);
      setGrants(data.grants);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load nominated readers.');
    }
  };

  useEffect(() => { setGrants(null); load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const revoke = async (email) => {
    if (!window.confirm(`Revoke ${email}'s access now? They keep no further access, and won't get the "your two weeks are up" email.`)) return;
    setBusyEmail(email);
    try {
      await adminFetch(`/api/admin/nominations/access/${encodeURIComponent(email)}/revoke`, { method: 'POST' });
      await load(filter);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not revoke that grant.');
    } finally {
      setBusyEmail(null);
    }
  };

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!grants) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const readCount = grants.filter((g) => g.has_read).length;

  const columns = [
    { key: 'nominee_name', label: 'Nominee', sortable: true, render: (g) => g.nominee_name || g.nominee_email },
    { key: 'nominator_name', label: 'Nominated by', sortable: true, render: (g) => g.nominator_name || g.nominator_email },
    { key: 'post_slug', label: 'Story', sortable: true },
    {
      key: 'has_read', label: 'Read?', sortable: true,
      render: (g) => (g.has_read ? `Yes (${g.open_count}×)` : 'Not yet'),
    },
    {
      key: 'expires_at', label: filter === 'expired' ? 'Expired' : 'Days left', sortable: true, align: 'right',
      render: (g) => {
        if (g.status === 'expired') return formatDate(g.expires_at);
        const d = daysUntil(g.expires_at);
        return d != null ? `${d}d` : '—';
      },
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (g) => g.status === 'active' ? (
        <button
          type="button"
          onClick={() => revoke(g.nominee_email)}
          disabled={busyEmail === g.nominee_email}
          className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60"
        >
          Revoke
        </button>
      ) : null,
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-6">
        <KPITile label={`${filter[0].toUpperCase()}${filter.slice(1)} grants`} value={grants.length} />
        <KPITile label="Have read their story" value={readCount} bordered />
      </div>

      <div className="flex gap-6 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`font-plex text-[13px] pb-1 border-b-2 capitalize transition-colors ${
              filter === f
                ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={grants}
        rowKey={(g) => g.nominee_email}
        searchKeys={['nominee_name', 'nominee_email', 'nominator_name']}
        searchPlaceholder="Search by nominee or nominator…"
        emptyMessage="No nominations in this view."
      />
    </div>
  );
};

export default NominatedReadersPanel;
