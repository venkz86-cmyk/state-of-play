import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDateTime } from '../../lib/format';

export const ReferralsPanel = ({ onAuthError }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await adminFetch('/api/admin/referrals');
        if (active) setData(result);
      } catch (e) {
        if (e instanceof AdminAuthError) { onAuthError?.(); return; }
        if (active) setError(e.message || 'Could not load referrals.');
      }
    })();
    return () => { active = false; };
  }, [onAuthError]);

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!data) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const totalCleared = data.accounts.reduce((sum, a) => sum + (a.cleared_paise || 0), 0);
  const totalReferred = data.accounts.reduce((sum, a) => sum + (a.referred_count || 0), 0);

  const accountColumns = [
    { key: 'email', label: 'Referrer', sortable: true },
    { key: 'referral_code', label: 'Code', sortable: true },
    { key: 'referred_count', label: 'Referred', sortable: true, align: 'right' },
    { key: 'cleared_paise', label: 'Cleared credit', sortable: true, align: 'right', render: (a) => formatCurrency(a.cleared_paise, 'INR') },
    { key: 'pending_paise', label: 'Pending credit', sortable: true, align: 'right', render: (a) => formatCurrency(a.pending_paise, 'INR') },
  ];

  const ledgerColumns = [
    { key: 'created_at', label: 'Date', sortable: true, render: (l) => formatDateTime(l.created_at) },
    { key: 'owner_ghost_member_id', label: 'Owner' },
    { key: 'entry_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason' },
    { key: 'amount_paise', label: 'Amount', align: 'right', render: (l) => formatCurrency(l.amount_paise, 'INR') },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-3 mb-8">
        <KPITile label="Referral accounts" value={data.accounts.length} />
        <KPITile label="Total referred" value={totalReferred} bordered />
        <KPITile label="Total cleared credit" value={formatCurrency(totalCleared, 'INR')} bordered />
      </div>

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">Accounts</p>
      <DataTable
        columns={accountColumns}
        rows={data.accounts}
        rowKey={(a) => a.email}
        searchKeys={['email', 'referral_code']}
        searchPlaceholder="Search by email or code…"
        emptyMessage="No referral accounts yet."
      />

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mt-10 mb-3">Recent ledger activity</p>
      <DataTable
        columns={ledgerColumns}
        rows={data.ledger}
        emptyMessage="No ledger entries yet."
      />
    </div>
  );
};

export default ReferralsPanel;
