import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrencyMajor, formatDate } from '../../lib/format';

// For a Team-5/10 payment whose team setup didn't finish at checkout
// (backend corporate.finish_team_setup): creates the team only if the
// Sheet doesn't have it yet, then emails the admin their team link.
const field = 'w-full bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[15px] py-2 focus:outline-none focus:border-[var(--accent-burgundy)]';
const label = 'block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';

const FinishSetup = ({ onDone, onAuthError }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [plan, setPlan] = useState('team-5');
  const [paymentId, setPaymentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await adminFetch('/api/admin/corporate/finish-setup', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), company_name: company.trim(), plan, payment_id: paymentId.trim() }),
      });
      setResult(data);
      onDone?.();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Team setup did not finish.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="finish-setup-open"
        className="mt-8 font-plex text-[13px] text-[var(--accent)] underline underline-offset-[5px] decoration-1 hover:decoration-2">
        Finish a team's setup
      </button>
    );
  }
  return (
    <form onSubmit={submit} data-testid="finish-setup-form" className="mt-10 pt-8 border-t border-[var(--rule)] max-w-[640px] space-y-5">
      <p className="font-editorial text-lg">Finish a team's setup</p>
      <p className="font-plex text-[13px] text-[var(--text-muted)]">
        For a Team-5 or Team-10 payment that didn't set up the team. If the Sheet already has a team for this
        admin, nothing new is created; either way the admin is emailed their team link.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <label className={label}>
          Admin email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="finish-setup-email" />
        </label>
        <label className={label}>
          Company name
          <input required value={company} onChange={(e) => setCompany(e.target.value)}
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="finish-setup-company" />
        </label>
        <label className={label}>
          Plan
          <select value={plan} onChange={(e) => setPlan(e.target.value)}
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="finish-setup-plan">
            <option value="team-5">Team-5</option>
            <option value="team-10">Team-10</option>
          </select>
        </label>
        <label className={label}>
          Razorpay payment ID (optional)
          <input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="pay_…"
            className={`${field} mt-1 normal-case tracking-normal`} data-testid="finish-setup-payment" />
        </label>
      </div>
      <button type="submit" disabled={busy} data-testid="finish-setup-submit"
        className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-11 px-6 disabled:opacity-50">
        {busy ? 'Working…' : 'Finish setup and send the link'}
      </button>
      {error && <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>}
      {result && (
        <p data-testid="finish-setup-result" className="font-plex text-[14px]">
          {result.existed
            ? `The Sheet already had this team${result.company_name ? ` (as “${result.company_name}”)` : ''}, so nothing new was created.`
            : `Team created as “${result.company_name}”.`}
          {' '}The team link is on its way to {email.trim()}.
          {result.existed && result.company_name && result.company_name !== company.trim()
            ? ' To change the team’s name, edit company_name for this row in the Corporate Subscriptions Sheet.'
            : ''}
        </p>
      )}
    </form>
  );
};

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
      render: (a) => formatCurrencyMajor(a.amount_paid, a.currency || 'INR'),
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
      <FinishSetup onDone={() => load(true)} onAuthError={onAuthError} />
    </div>
  );
};

export default CorporateAccountsPanel;
