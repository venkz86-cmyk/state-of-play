import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate } from '../../lib/format';
import { BackfillPanel } from './BackfillPanel';

// Phase 6, the checkpoint the whole build was aimed at: one page that
// answers "who's subscribed, what did they pay, what's expiring, what
// needs my attention today" -- no new data source, just aggregates over
// everything Phases 2-5 already built (GET /api/admin/overview reuses
// the exact same per-subscriber row logic Subscribers/Renewals show).
export const OverviewPanel = ({ onAuthError }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await adminFetch('/api/admin/overview');
        if (active) setData(result);
      } catch (e) {
        if (e instanceof AdminAuthError) { onAuthError?.(); return; }
        if (active) setError(e.message || 'Could not load the overview.');
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

  const { kpis, attention } = data;
  const goTo = (path) => navigate(`/admin/dashboard/${path}`);

  const attentionItems = [
    attention.pending_comments > 0 && {
      key: 'comments',
      text: `${attention.pending_comments} comment${attention.pending_comments === 1 ? '' : 's'} waiting on review`,
      path: 'comments',
    },
    attention.expired_but_still_paid.length > 0 && {
      key: 'expired',
      text: `${kpis.expired_but_still_paid} subscriber${kpis.expired_but_still_paid === 1 ? '' : 's'} carrying a paid label past their computed expiry`,
      path: 'subscribers',
    },
    attention.expiring_7d.length > 0 && {
      key: 'expiring',
      text: `${attention.expiring_7d.length} subscriber${attention.expiring_7d.length === 1 ? '' : 's'} expiring within 7 days`,
      path: 'renewals',
    },
  ].filter(Boolean);

  return (
    <div>
      <h2 className="font-editorial font-semibold text-[22px] leading-tight mb-6">
        Signed in.
      </h2>

      <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-4 mb-8">
        <KPITile label="Subscribers" value={kpis.total_subscribers} sublabel={`${kpis.paid} paid, ${kpis.free} free`} />
        <KPITile label="Revenue, 30 days" value={`${formatCurrency(kpis.revenue_30d.INR, 'INR')} / ${formatCurrency(kpis.revenue_30d.USD, 'USD')}`} bordered />
        <KPITile label="Revenue, 365 days" value={`${formatCurrency(kpis.revenue_365d.INR, 'INR')} / ${formatCurrency(kpis.revenue_365d.USD, 'USD')}`} bordered />
        <KPITile label="Corporate accounts" value={kpis.corporate_accounts} bordered />
      </div>
      <div className="border-b border-[var(--rule)] grid grid-cols-2 md:grid-cols-4 mb-8">
        <KPITile label="Active trials" value={kpis.active_trials} />
        <KPITile label="Active nominations" value={kpis.active_nominations} bordered />
        <KPITile label="Expiring in 30 days" value={kpis.expiring_30d} bordered />
        <KPITile
          label="Paid but past expiry"
          value={kpis.expired_but_still_paid}
          bordered
          accent={kpis.expired_but_still_paid > 0}
        />
      </div>

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
        Needs attention
      </p>
      {attentionItems.length === 0 ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)] mb-10">
          Nothing needs your attention right now.
        </p>
      ) : (
        <ul className="mb-10">
          {attentionItems.map((item) => (
            <li key={item.key} className="border-b border-[var(--rule)] py-3 flex items-center justify-between gap-4">
              <span className="font-plex text-[14px]">{item.text}</span>
              <button
                type="button"
                onClick={() => goTo(item.path)}
                className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 shrink-0"
              >
                Review →
              </button>
            </li>
          ))}
        </ul>
      )}

      {attention.expired_but_still_paid.length > 0 && (
        <div className="mb-10">
          <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
            Paid label, expiry already passed
          </p>
          <ul>
            {attention.expired_but_still_paid.map((r) => (
              <li key={r.email} className="border-b border-[var(--rule)] py-2 flex items-center justify-between gap-4">
                <span className="font-plex text-[13px]">{r.name || r.email} <span className="text-[var(--text-muted)]">({r.email})</span></span>
                <span className="font-plex text-[13px] text-[var(--accent-burgundy)]">{formatDate(r.computed_expiry)} · {r.expiry_source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BackfillPanel onAuthError={onAuthError} />
    </div>
  );
};

export default OverviewPanel;
