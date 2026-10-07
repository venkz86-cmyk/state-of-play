import { useEffect, useMemo, useState } from 'react';
import { DataTable } from './DataTable';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate, daysUntil } from '../../lib/format';
import { BulkEmailControls, RowSendButton, daysSince } from './BulkEmailControls';

const LAPSED_ENDPOINT = '/api/admin/annual-renewal/send-lapsed';

const FILTERS = [
  { key: 'all', label: 'All with an expiry' },
  { key: 'next30', label: 'Next 30 days' },
  { key: 'drift', label: 'Overdue, still labeled paid' },
  { key: 'lapsed', label: 'Lapsed, not renewed' },
];

// Same subscriber data GET /api/admin/subscribers already returns --
// this is a sorted, filtered VIEW of it, not a second data source. See
// the plan's own cross-cutting decision on this.
export const RenewalsPanel = ({ onAuthError }) => {
  const [subscribers, setSubscribers] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('next30');
  // Former members whose year ended and who haven't renewed, from
  // GET /api/admin/annual-renewal/lapsed (only loaded on that tab).
  const [lapsed, setLapsed] = useState(null);
  const [gapDays, setGapDays] = useState(30);
  const [sendResult, setSendResult] = useState(null);

  const loadLapsed = async () => {
    try {
      const data = await adminFetch('/api/admin/annual-renewal/lapsed');
      setLapsed(data.members || []);
      if (data.gap_days) setGapDays(data.gap_days);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load lapsed members.');
    }
  };

  useEffect(() => {
    if (filter === 'lapsed' && lapsed === null) loadLapsed();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const tabs = (
      <div className="flex flex-wrap gap-6 mb-6">
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
  );

  if (filter === 'lapsed') {
    if (!lapsed) {
      return <div>{tabs}<p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p></div>;
    }
    // Who "Email all" sends to: everyone not already sent the note in the last gapDays.
    const due = lapsed.filter((m) => {
      const d = daysSince(m.lapsed_sent);
      return d == null || d >= gapDays;
    });
    const lapsedColumns = [
      { key: 'name', label: 'Name', sortable: true, render: (r) => r.name || '—' },
      { key: 'email', label: 'Email', sortable: true },
      {
        key: 'last_payment', label: 'Last payment', align: 'right',
        render: (r) => r.last_payment ? formatCurrency(r.last_payment.amount, r.last_payment.currency) : '—',
      },
      { key: 'expiry', label: 'Year ended', sortable: true, align: 'right', render: (r) => formatDate(r.expiry) },
      {
        key: 'still_comped', label: 'Ghost', sortable: true,
        render: (r) => (r.still_comped
          ? <span className="font-plex text-[12px] text-[var(--accent-burgundy)]">Still comped</span>
          : <span className="font-plex text-[12px] text-[var(--text-muted)]">Free</span>),
      },
      {
        key: 'last_emailed', label: 'Last emailed', sortable: true, align: 'right',
        render: (r) => (r.last_emailed ? `${formatDate(r.last_emailed)} (${daysSince(r.last_emailed)}d ago)` : 'Never'),
      },
      {
        key: 'actions', label: '', align: 'right',
        render: (r) => {
          const d = daysSince(r.lapsed_sent);
          if (d != null && d < gapDays) return <span className="font-plex text-[12px] text-[var(--text-muted)]">Sent</span>;
          return (
            <RowSendButton endpoint={LAPSED_ENDPOINT} email={r.email} label="Send"
              onSent={loadLapsed} onAuthError={onAuthError} setResult={setSendResult} />
          );
        },
      },
    ];
    return (
      <div>
        {tabs}
        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-4 max-w-[70ch]">
          Former annual members whose year has ended and who haven't renewed. The note offers ₹2,999 + GST ($149)
          and links to their own /renew page. Nobody gets it twice within {gapDays} days.
        </p>
        {lapsed.some((m) => m.still_comped) && (
          <p data-testid="lapsed-still-comped" className="font-plex text-[13px] text-[var(--accent-burgundy)] mb-4 max-w-[70ch]">
            {lapsed.filter((m) => m.still_comped).length} of them are still comped in Ghost, so they can still read
            every story and stay on Ghost's paid list. Remove the comp in Ghost to end their access.
          </p>
        )}
        <BulkEmailControls
          endpoint={LAPSED_ENDPOINT}
          emails={due.map((m) => m.email)}
          allLabel={(n) => `Email all ${n}`}
          confirmText={(n) => `Send the renewal note to ${n} ${n === 1 ? 'person' : 'people'}?`}
          onSent={loadLapsed}
          onAuthError={onAuthError}
          result={sendResult}
          setResult={setSendResult}
        />
        <DataTable
          columns={lapsedColumns}
          rows={lapsed}
          rowKey={(r) => r.email}
          searchKeys={['name', 'email']}
          searchPlaceholder="Search by name or email…"
          emptyMessage="No lapsed members right now."
        />
      </div>
    );
  }

  return (
    <div>
      {tabs}

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
