import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';

// Plain names for the buttons in payments.SIGNUP_SOURCES.
const SOURCE_LABEL = {
  'story-email-gate': 'Sign-up box on a story',
  'left-field-form': 'Left Field page form',
  'signup-page': '/signup page',
  paywall: 'Paywall Subscribe button',
  'trial-page': '/trial page',
  'trial-via-paywall': '/trial, via the paywall line',
  'trial-via-home': '/trial, via the homepage line',
  'trial-via-signup': '/trial, via the /signup line',
  'trial-upgrade-page': 'The Ten upgrade, /trial page',
  'account-ten-panel': 'The Ten upgrade, account page',
  'account-renew': 'Renew, account page',
  'renew-page': 'Renew, /renew letter',
  'student-pay-link': 'Student pay link',
  'gift-page': 'Gift page',
  'teams-page': 'Teams page',
  unknown: 'Not recorded',
};
const PLAN_LABEL = {
  standard: 'Annual', trial: 'The Ten', 'trial-upgrade': 'The Ten upgrade',
  renewal: 'Renewal', student: 'Student', 'team-5': 'Team-5', 'team-10': 'Team-10', gift: 'Gift',
};
const WEEK_OPTIONS = [4, 8, 26];

const weekLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Turns {name: count} into sorted table rows.
const toRows = (counts, labels) =>
  Object.entries(counts || {})
    .map(([key, count]) => ({ key, label: labels ? labels[key] || key : key, count }))
    .sort((a, b) => b.count - a.count);

const Section = ({ title, children }) => (
  <div className="mb-10">
    <p className="font-editorial italic text-lg mb-3">{title}</p>
    {children}
  </div>
);

// Where new free members, payments and gifts came from: which button on
// the site, and which ?ref= tag the visitor first arrived with. Counted
// from the day tracking went live (5 October 2026).
export const SourcesPanel = ({ onAuthError }) => {
  const [weeks, setWeeks] = useState(8);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/attribution?weeks=${weeks}`);
        if (active) setData(res);
      } catch (e) {
        if (e instanceof AdminAuthError) { onAuthError?.(); return; }
        if (active) setError(e.message || 'Could not load sources.');
      }
    })();
    return () => { active = false; };
  }, [weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  if (!data) return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;

  const t = data.totals;
  const count = { key: 'count', label: 'Count', sortable: true, align: 'right' };
  const named = (label) => ({ key: 'label', label, sortable: true });

  return (
    <div>
      <div className="flex gap-6 mb-6">
        {WEEK_OPTIONS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWeeks(w)}
            className={`font-plex text-[13px] pb-1 border-b-2 transition-colors ${
              weeks === w
                ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Last {w} weeks
          </button>
        ))}
      </div>

      <div className="border-y border-[var(--rule)] grid grid-cols-3 mb-10">
        <KPITile label="New free members" value={t.free} />
        <KPITile label="New payments" value={t.paid} bordered />
        <KPITile label="Gifts bought" value={t.gift} bordered />
      </div>

      <Section title="Free sign-ups, by button">
        <DataTable columns={[named('Button'), count]} rows={toRows(t.free_by_source, SOURCE_LABEL)}
          rowKey={(r) => r.key} emptyMessage="No free sign-ups recorded yet." />
      </Section>

      <Section title="Payments, by plan">
        <DataTable columns={[named('Plan'), count]} rows={toRows(t.paid_by_plan, PLAN_LABEL)}
          rowKey={(r) => r.key} emptyMessage="No payments recorded yet." />
      </Section>

      <Section title="Payments, by button">
        <DataTable columns={[named('Button'), count]} rows={toRows(t.paid_by_source, SOURCE_LABEL)}
          rowKey={(r) => r.key} emptyMessage="No payments recorded yet." />
      </Section>

      <Section title="By link tag (?ref=)">
        <DataTable
          columns={[
            { key: 'key', label: 'Tag', sortable: true, render: (r) => (r.key === 'direct' ? 'No tag' : r.key) },
            { key: 'free', label: 'Free', sortable: true, align: 'right' },
            { key: 'paid', label: 'Paid', sortable: true, align: 'right' },
          ]}
          rows={Object.entries(t.by_ref || {}).map(([key, v]) => ({ key, ...v })).sort((a, b) => (b.free + b.paid) - (a.free + a.paid))}
          rowKey={(r) => r.key}
          emptyMessage="Nothing recorded yet."
        />
      </Section>

      <Section title="Week by week">
        <DataTable
          columns={[
            { key: 'week_start', label: 'Week of', sortable: true, render: (w) => weekLabel(w.week_start) },
            { key: 'free', label: 'Free', sortable: true, align: 'right' },
            { key: 'paid', label: 'Paid', sortable: true, align: 'right' },
            { key: 'gift', label: 'Gifts', sortable: true, align: 'right' },
          ]}
          rows={data.weeks}
          rowKey={(w) => w.week_start}
          emptyMessage="Nothing recorded yet."
        />
      </Section>

      <p className="font-plex text-[13px] text-[var(--text-muted)] max-w-[60ch]">
        Counted from 5 October 2026. Add ?ref= to links you share so they show up here:
        ?ref=linkedin, ?ref=x, ?ref=whatsapp, ?ref=leftfield, ?ref=email.
      </p>
    </div>
  );
};

export default SourcesPanel;
