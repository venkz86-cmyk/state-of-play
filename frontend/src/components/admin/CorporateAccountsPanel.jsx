import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate } from '../../lib/format';

// Read-only in v1 -- actual seat management stays on the existing
// token-gated /teams/manage page, a deliberately different persona/flow
// this doesn't touch. This is the first place any of this has ever been
// visible outside the raw Google Sheet.
export const CorporateAccountsPanel = ({ onAuthError }) => {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const data = await adminFetch(`/api/admin/corporate/accounts${refresh ? '?refresh=true' : ''}`);
      setAccounts(data.accounts);
      setError('');
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load corporate accounts.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !accounts) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!accounts) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const totalSeats = accounts.reduce((sum, a) => sum + (Number(a.seats) || 0), 0);
  const filledSeats = accounts.reduce((sum, a) => sum + (Number(a.member_count) || 0), 0);

  const columns = [
    { key: 'company_name', label: 'Company', sortable: true },
    { key: 'admin_email', label: 'Admin email', sortable: true },
    { key: 'company_domain', label: 'Domain(s)' },
    { key: 'plan_name', label: 'Plan', sortable: true },
    { key: 'seats', label: 'Seats', sortable: true, align: 'right', render: (a) => `${a.member_count ?? 0}/${a.seats ?? '—'}` },
    {
      key: 'amount_paid', label: 'Amount paid', sortable: true, align: 'right',
      render: (a) => formatCurrency(a.amount_paid, a.currency || 'INR'),
    },
    { key: 'renewal_date', label: 'Renewal', sortable: true, render: (a) => (a.renewal_date ? formatDate(a.renewal_date) : '—') },
    {
      key: 'status', label: 'Status',
      render: (a) => (
        <span style={{ color: a.status === 'active' ? 'var(--text)' : 'var(--accent-burgundy)' }}>
          {a.status || '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-3 mb-6">
        <KPITile label="Corporate accounts" value={accounts.length} />
        <KPITile label="Seats filled" value={`${filledSeats}/${totalSeats}`} bordered />
        <KPITile label="Active" value={accounts.filter((a) => a.status === 'active').length} bordered />
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)]">
          From the Corporate Subscriptions Sheet — cached up to 60s
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh →'}
        </button>
      </div>
      {error && (
        <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mb-3">{error}</p>
      )}

      <DataTable
        columns={columns}
        rows={accounts}
        rowKey={(a) => a.account_id}
        searchKeys={['company_name', 'admin_email', 'company_domain']}
        searchPlaceholder="Search by company, email, or domain…"
        emptyMessage="No corporate accounts yet."
      />
    </div>
  );
};

export default CorporateAccountsPanel;
