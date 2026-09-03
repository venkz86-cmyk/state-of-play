import { useEffect, useMemo, useState } from 'react';
import { DataTable } from './DataTable';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate, daysUntil } from '../../lib/format';

const FILTERS = [
  { key: 'all', label: 'All with an expiry' },
  { key: 'next30', label: 'Next 30 days' },
  { key: 'drift', label: 'Overdue, still labeled paid' },
];

// Same subscriber data GET /api/admin/subscribers already returns --
// this is a sorted, filtered VIEW of it, not a second data source. See
// the plan's own cross-cutting decision on this.
export const RenewalsPanel = ({ onAuthError }) => {
  const [subscribers, setSubscribers] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('next30');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await adminFetch('/api/admin/subscribers');
        if (active) setSubscribers(data.subscribers);
      } catch (e) {
        if (e instanceof AdminAuthError) { onAuthError?.(); return; }
        if (active) setError(e.message || 'Could not load renewals.');
      }
    })();
    return () => { active = false; };
  }, [onAuthError]);

  const rows = useMemo(() => {
    if (!subscribers) return [];
    let withExpiry = subscribers.filter((s) => s.computed_expiry);
    if (filter === 'next30') {
      withExpiry = withExpiry.filter((s) => {
        const d = daysUntil(s.computed_expiry);
        return d != null && d <= 30;
      });
    } else if (filter === 'drift') {
      withExpiry = withExpiry.filter((s) => s.expired_but_still_paid);
    }
    return withExpiry.sort((a, b) => new Date(a.computed_expiry) - new Date(b.computed_expiry));
  }, [subscribers, filter]);

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!subscribers) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (r) => r.name || '—' },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'tier', label: 'Plan', sortable: true },
    {
      key: 'last_payment', label: 'Last payment', align: 'right',
      render: (r) => r.last_payment ? formatCurrency(r.last_payment.amount, r.last_payment.currency) : '—',
    },
    {
      key: 'computed_expiry', label: 'Expires', sortable: true, align: 'right',
      render: (r) => {
        const d = daysUntil(r.computed_expiry);
        const overdue = d != null && d < 0;
        return (
          <span style={{ color: overdue ? 'var(--accent-burgundy)' : 'var(--text)' }}>
            {formatDate(r.computed_expiry)}
            {overdue ? ` (${Math.abs(d)}d overdue)` : d != null ? ` (${d}d)` : ''}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex gap-6 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`font-plex text-[13px] pb-1 border-b-2 transition-colors ${
              filter === f.key
                ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.email}
        searchKeys={['name', 'email']}
        searchPlaceholder="Search by name or email…"
        emptyMessage="Nothing in this window."
      />
    </div>
  );
};

export default RenewalsPanel;
