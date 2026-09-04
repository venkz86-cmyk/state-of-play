import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate, daysUntil } from '../../lib/format';
import { useCountDelta } from '../../lib/useCountDelta';

const TIER_LABEL = {
  standard: 'Annual', student: 'Student', trial: 'Trial',
  nomination: 'Nominated', comped: 'Comped', free: 'Free',
};

const expiryTone = (row) => {
  if (row.expired_but_still_paid) return 'var(--accent-burgundy)';
  const d = daysUntil(row.computed_expiry);
  if (d != null && d <= 30) return 'var(--accent-burgundy)';
  return 'var(--text)';
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'free', label: 'Free' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'student', label: 'Student' },
  { value: 'trial', label: 'Trial' },
  { value: 'nomination', label: 'Nominated' },
  { value: 'comped', label: 'Comped' },
  { value: 'standard', label: 'Annual' },
];

const matchesFilter = (row, filter) => {
  switch (filter) {
    case 'all': return true;
    case 'paid': return row.is_paid;
    case 'free': return !row.is_paid;
    case 'corporate': return !!row.company_name;
    case 'standard': return row.tier === 'standard' && !row.company_name;
    default: return row.tier === filter;
  }
};

export const SubscribersPanel = ({ onAuthError }) => {
  const [subscribers, setSubscribers] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState({});
  const [filter, setFilter] = useState('all');
  const [driftOnly, setDriftOnly] = useState(false);

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

  // Hooks must run unconditionally on every render -- called here, above
  // the early returns below, with `subscribers?.length` as null until it
  // loads (useCountDelta itself no-ops on a null value).
  const subscriberDelta = useCountDelta('tsop_admin_subscribers_count', subscribers?.length ?? null);

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!subscribers) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const paidCount = subscribers.filter((s) => s.is_paid).length;
  const driftCount = subscribers.filter((s) => s.expired_but_still_paid).length;

  const filteredRows = subscribers
    .filter((r) => matchesFilter(r, filter))
    .filter((r) => !driftOnly || r.expired_but_still_paid);

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
      <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-3 mb-6">
        <KPITile
          label="Total members"
          value={subscribers.length}
          sublabel={subscriberDelta ? `+${subscriberDelta} since last visit` : undefined}
        />
        <KPITile label="Paid" value={paidCount} bordered />
        <KPITile label="Label/payment drift" value={driftCount} accent={driftCount > 0} bordered />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
        <div className="flex flex-wrap gap-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`font-plex text-[13px] pb-1 border-b-2 transition-colors ${
                filter === f.value
                  ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="font-plex text-[13px] text-[var(--text-muted)] flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={driftOnly} onChange={(e) => setDriftOnly(e.target.checked)} />
          Drift only
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.email}
        searchKeys={['name', 'email']}
        searchPlaceholder="Search by name or email…"
        emptyMessage="No subscribers match this filter."
        onRowClick={onRowClick}
      />

      {expanded && (
        <div className="mt-6 pt-6 border-t border-[var(--rule)]">
          <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
            Ghost labels — {expanded}
          </p>
          <p className="font-plex text-[13px] text-[var(--text-muted)] mb-6">
            {(() => {
              const row = subscribers.find((s) => s.email === expanded);
              const labels = row?.label_names || [];
              return labels.length > 0 ? labels.join(', ') : 'No labels on this member.';
            })()}
          </p>
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
