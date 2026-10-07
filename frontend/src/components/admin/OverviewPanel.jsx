import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate } from '../../lib/format';

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
      key: 'comments', count: attention.pending_comments, path: 'comments',
      text: `${attention.pending_comments === 1 ? 'comment' : 'comments'} waiting for review`,
    },
    attention.expired_but_still_paid.length > 0 && {
      key: 'expired', count: kpis.expired_but_still_paid, path: 'subscribers',
      text: `${kpis.expired_but_still_paid === 1 ? 'member' : 'members'} still labelled paid after their year ended`,
    },
    attention.expiring_7d.length > 0 && {
      key: 'expiring', count: attention.expiring_7d.length, path: 'renewals',
      text: `${attention.expiring_7d.length === 1 ? 'member whose year ends' : 'members whose year ends'} in the next 7 days`,
    },
    attention.ghost_status_downgraded.length > 0 && {
      key: 'ghost-downgraded', count: kpis.ghost_status_downgraded, path: 'subscribers',
      text: `paying ${kpis.ghost_status_downgraded === 1 ? 'member' : 'members'} Ghost shows as free`,
    },
  ].filter(Boolean);

  const num = (n) => (n ?? 0).toLocaleString('en-IN');
  const label = 'section-label text-[var(--text-label)] block mb-3';

  return (
    <div data-testid="admin-today">
      <section className="mb-12" data-testid="today-needs-you">
        <p className={label}>Needs you</p>
        {attentionItems.length === 0 ? (
          <p className="font-plex text-[15px] text-[var(--text-muted)] border-y border-[var(--rule)] py-5">
            Nothing needs you today.
          </p>
        ) : (
          <ul className="border-t border-[var(--rule)]">
            {attentionItems.map((item) => (
              <li key={item.key} className="border-b border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => goTo(item.path)}
                  className="w-full flex items-center gap-5 py-4 text-left group"
                >
                  <span className="font-editorial text-[32px] leading-none text-[var(--accent-burgundy)] tabular-nums min-w-[2.5ch]">
                    {item.count}
                  </span>
                  <span className="font-plex text-[15px] flex-1">{item.text}</span>
                  <span className="font-plex text-[13px] text-[var(--text-muted)] group-hover:text-[var(--accent-burgundy)] shrink-0">
                    Open →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6" data-testid="today-numbers">
        <p className={label}>The numbers</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-px bg-[var(--rule)] border border-[var(--rule)]">
          {[
            ['Subscribers', num(kpis.total_subscribers), `${num(kpis.paid)} paid, ${num(kpis.free)} free`],
            ['Revenue, 30 days', formatCurrency(kpis.revenue_30d.INR, 'INR'), `and ${formatCurrency(kpis.revenue_30d.USD, 'USD')}`],
            ['Revenue, 365 days', formatCurrency(kpis.revenue_365d.INR, 'INR'), `and ${formatCurrency(kpis.revenue_365d.USD, 'USD')}`],
            ['Expiring in 30 days', num(kpis.expiring_30d), 'annual members'],
          ].map(([name, value, sub]) => (
            <div key={name} className="bg-[var(--bg)] p-4 sm:p-5 lg:p-6 min-w-0">
              <p className="font-plex text-[13px] text-[var(--text-muted)] mb-2">{name}</p>
              <p className="font-editorial text-[22px] sm:text-[26px] lg:text-[30px] leading-none tabular-nums">{value}</p>
              {sub && <p className="font-plex text-[12px] text-[var(--text-muted)] mt-2">{sub}</p>}
            </div>
          ))}
        </div>
      </section>

      <details className="mb-12 group" data-testid="today-more">
        <summary className="cursor-pointer list-none font-plex text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] py-2 select-none">
          <span className="group-open:hidden">More numbers ↓</span>
          <span className="hidden group-open:inline">Fewer numbers ↑</span>
        </summary>
        <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-5 mt-3">
          <KPITile label="Corporate accounts" value={kpis.corporate_accounts} />
          <KPITile label="In The Ten" value={kpis.active_trials} bordered />
          <KPITile label="Nominated now" value={kpis.active_nominations} bordered />
          <KPITile label="Paid but past expiry" value={kpis.expired_but_still_paid} bordered accent={kpis.expired_but_still_paid > 0} />
          <KPITile label="Free readers who paid" value={kpis.free_to_paid_conversions} sublabel="signed up free, later paid" bordered />
        </div>
      </details>

      {attention.expired_but_still_paid.length > 0 && (
        <section className="mb-10">
          <p className={label}>Labelled paid, year already ended</p>
          <ul>
            {attention.expired_but_still_paid.map((r) => (
              <li key={r.email} className="border-b border-[var(--rule)] py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="font-plex text-[14px]">{r.name || r.email} <span className="text-[var(--text-muted)]">({r.email})</span></span>
                <span className="font-plex text-[13px] text-[var(--accent-burgundy)]">{formatDate(r.computed_expiry)} · {r.expiry_source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {attention.ghost_status_downgraded.length > 0 && (
        <section className="mb-10">
          <p className={label}>Paying, but Ghost shows free</p>
          <p className="font-plex text-[14px] text-[var(--text-muted)] mb-3 max-w-[64ch]">
            Ghost's own comp ran out on its own clock. They still read everything on the site. Restore their Ghost
            status by hand to the date shown.
          </p>
          <ul>
            {attention.ghost_status_downgraded.map((r) => (
              <li key={r.email} className="border-b border-[var(--rule)] py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="font-plex text-[14px]">{r.name || r.email} <span className="text-[var(--text-muted)]">({r.email})</span></span>
                <span className="font-plex text-[13px] text-[var(--accent-burgundy)]">
                  restore to {r.restore_to_date ? formatDate(r.restore_to_date) : 'unknown (no payment on record)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default OverviewPanel;
