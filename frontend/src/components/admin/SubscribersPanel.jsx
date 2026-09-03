import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate, daysUntil } from '../../lib/format';

const TIER_LABEL = {
  standard: 'Annual', student: 'Student', trial: 'Trial',
  nomination: 'Nominated', free: 'Free',
};

const expiryTone = (row) => {
  if (row.expired_but_still_paid) return 'var(--accent-burgundy)';
  const d = daysUntil(row.computed_expiry);
  if (d != null && d <= 30) return 'var(--accent-burgundy)';
  return 'var(--text)';
};

export const SubscribersPanel = ({ onAuthError }) => {
  const [subscribers, setSubscribers] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await adminFetch('/api/admin/subscribers');
        if (active) setSubscribers(data.subscribers);
      } catch (e) {
        if (e instanceof AdminAuthError) { onAuthError?.(); return; }
        if (active) setError(e.message || 'Could not load subscribers.');
      }
    })();
    return () => { active = false; };
  }, [onAuthError]);

  const onRowClick = async (row) => {
    const key = row.email;
    setExpanded((prev) => (prev === key ? null : key));
    if (!history[key]) {
      try {
        const data = await adminFetch(`/api/admin/payments?email=${encodeURIComponent(key)}`);
        setHistory((prev) => ({ ...prev, [key]: data.payments }));
      } catch (e) {
        if (e instanceof AdminAuthError) onAuthError?.();
      }
    }
  };

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!subscribers) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const paidCount = subscribers.filter((s) => s.is_paid).length;
  const driftCount = subscribers.filter((s) => s.expired_but_still_paid).length;

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (r) => r.name || '—' },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'tier', label: 'Plan', sortable: true,
      render: (r) => (r.is_paid ? (TIER_LABEL[r.tier] || r.tier) : 'Free'),
    },
    {
      key: 'last_payment', label: 'Last payment', sortable: false, align: 'right',
      render: (r) => r.last_payment ? formatCurrency(r.last_payment.amount, r.last_payment.currency) : '—',
    },
    {
      key: 'computed_expiry', label: 'Expires', sortable: true, align: 'right',
      render: (r) => (
        <span style={{ color: expiryTone(r) }}>
          {r.computed_expiry ? formatDate(r.computed_expiry) : '—'}
          {r.expired_but_still_paid && ' ⚠'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-3 mb-8">
        <KPITile label="Total members" value={subscribers.length} />
        <KPITile label="Paid" value={paidCount} bordered />
        <KPITile label="Label/payment drift" value={driftCount} accent={driftCount > 0} bordered />
      </div>

      <DataTable
        columns={columns}
        rows={subscribers}
        rowKey={(r) => r.email}
        searchKeys={['name', 'email']}
        searchPlaceholder="Search by name or email…"
        emptyMessage="No subscribers found."
        onRowClick={onRowClick}
      />

      {expanded && (
        <div className="mt-6 pt-6 border-t border-[var(--rule)]">
          <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
            Payment history — {expanded}
          </p>
          {!history[expanded] ? (
            <p className="font-plex text-[13px] text-[var(--text-muted)]">Loading…</p>
          ) : history[expanded].length === 0 ? (
            <p className="font-plex text-[13px] text-[var(--text-muted)]">No recorded payments for this member.</p>
          ) : (
            <ul className="space-y-2">
              {history[expanded].map((p) => (
                <li key={p.payment_id} className="font-plex text-[13px] flex justify-between border-b border-[var(--rule)]/50 py-2">
                  <span>{formatDate(p.razorpay_created_at)} · {p.plan} · {p.source}</span>
                  <span className="tabular-nums">{formatCurrency(p.amount, p.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SubscribersPanel;
