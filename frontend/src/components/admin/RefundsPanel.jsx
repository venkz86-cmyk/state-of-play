import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';

// Money → Refunds: find a reader's payment and refund it, in full or in
// part, without going to Razorpay (refunds.py). Paid-twice and overpaid
// refunds happen by themselves and are listed under Recent refunds.

const PLAN_LABEL = {
  standard: 'Annual', renewal: 'Renewal', 'trial-upgrade': 'Upgrade from The Ten', trial: 'The Ten',
  student: 'Student', 'team-5': 'Team-5', 'team-10': 'Team-10', 'community-ftwtsop': 'Annual (community link)',
};
const REASONS = [
  { key: 'asked', label: 'Asked for a refund' },
  { key: 'paid_twice', label: 'Paid twice' },
  { key: 'overpaid', label: 'Paid the new-reader price' },
  { key: 'other', label: 'Other' },
];
const BY_LABEL = { automatic: 'Automatic', dashboard: 'You', razorpay: 'In Razorpay' };
const STATUS_LABEL = { processed: 'Done', pending: 'On its way', failed: 'Failed' };

const label = 'font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';
const field = 'bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[14px] py-1 focus:outline-none focus:border-[var(--accent-burgundy)]';
const primary = 'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 disabled:opacity-50';
const quiet = 'font-plex text-[13px] text-[var(--accent-ink)] underline underline-offset-4 hover:text-[var(--text)] disabled:opacity-50';

const toMinor = (major) => Math.round(parseFloat(String(major).replace(/[^0-9.]/g, '')) * 100);

const RefundForm = ({ payment, onDone, onAuthError }) => {
  const full = payment.refundable;
  const [choice, setChoice] = useState(payment.renewal_difference ? 'difference' : 'full');
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState(payment.renewal_difference ? 'overpaid' : 'asked');
  const [endAccess, setEndAccess] = useState(true);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const amount = choice === 'full' ? full : choice === 'difference' ? payment.renewal_difference : toMinor(custom);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= full;
  const isFull = amount === full;
  const money = (m) => formatCurrency(m, payment.currency);

  const pick = (c) => {
    setChoice(c);
    if (c === 'difference') setReason('overpaid');
    else if (reason === 'overpaid') setReason('asked');
  };

  const submit = async () => {
    const ending = isFull && payment.can_end_access && endAccess;
    const lines = [`Refund ${money(amount)} to ${payment.email}?`];
    if (ending) lines.push('Their membership ends, unless another payment still covers them.');
    lines.push('This can’t be undone.');
    if (!window.confirm(lines.join('\n\n'))) return;
    setBusy(true); setError('');
    try {
      const res = await adminFetch('/api/admin/refunds', {
        method: 'POST',
        body: JSON.stringify({ payment_id: payment.payment_id, amount, reason, end_access: ending, notify }),
      });
      onDone(res);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'The refund didn’t go through.');
    } finally {
      setBusy(false);
    }
  };

  const radio = (key, text) => (
    <label className="flex items-center gap-2 font-plex text-[14px] cursor-pointer">
      <input type="radio" name={`amt-${payment.payment_id}`} checked={choice === key} onChange={() => pick(key)} data-testid={`refund-choice-${key}`} />
      {text}
    </label>
  );

  return (
    <div className="mt-4 mb-2 pl-4 border-l-2 border-[var(--accent-burgundy)] space-y-4" data-testid="refund-form">
      <div className="space-y-2">
        <p className={label}>How much</p>
        {radio('full', <>Everything left: <span className="tabular-nums">{money(full)}</span></>)}
        {payment.renewal_difference && radio('difference', <>The renewal-rate difference: <span className="tabular-nums">{money(payment.renewal_difference)}</span> <span className="text-[var(--text-muted)]">(they paid the new-reader price)</span></>)}
        <div className="flex items-center gap-2">
          {radio('custom', 'A different amount:')}
          <span className="font-plex text-[14px]">{payment.currency === 'INR' ? '₹' : '$'}</span>
          <input
            inputMode="decimal" value={custom} placeholder="0"
            onChange={(e) => { setCustom(e.target.value); pick('custom'); }}
            className={`${field} w-[110px] tabular-nums`} data-testid="refund-custom"
          />
        </div>
        {choice === 'custom' && custom && !valid && (
          <p className="font-plex text-[12px] text-[var(--accent-ink)]">Up to {money(full)}.</p>
        )}
      </div>

      <label className="block">
        <span className={label}>Why</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} block mt-1`} data-testid="refund-reason">
          {REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>

      <div className="space-y-2">
        {isFull && payment.can_end_access && (
          <label className="flex items-start gap-2 font-plex text-[14px] cursor-pointer">
            <input type="checkbox" className="mt-1" checked={endAccess} onChange={(e) => setEndAccess(e.target.checked)} data-testid="refund-end-access" />
            <span>End their membership<br /><span className="text-[13px] text-[var(--text-muted)]">Removes their paid access, unless another payment still covers them.</span></span>
          </label>
        )}
        {isFull && !payment.can_end_access && (
          <p className="font-plex text-[13px] text-[var(--text-muted)]">
            {payment.plan === 'trial' ? 'Their ten stories stay unlocked.' : 'Team access is managed in the Corporate Sheet.'}
          </p>
        )}
        {!isFull && <p className="font-plex text-[13px] text-[var(--text-muted)]">A part refund leaves their membership as it is.</p>}
        <label className="flex items-center gap-2 font-plex text-[14px] cursor-pointer">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} data-testid="refund-notify" />
          Email them that the refund is on its way
        </label>
      </div>

      <div className="flex items-center gap-5">
        <button type="button" className={primary} disabled={!valid || busy} onClick={submit} data-testid="refund-submit">
          {busy ? 'Refunding…' : valid ? `Refund ${money(amount)}` : 'Refund'}
        </button>
        <button type="button" className={quiet} onClick={() => onDone(null)}>Cancel</button>
      </div>
      {error && <p className="font-plex text-[13px] text-[var(--accent-ink)]">{error}</p>}
    </div>
  );
};

const PaymentRow = ({ p, open, onOpen, onDone, onAuthError }) => {
  const refunded = p.amount_refunded > 0;
  return (
    <li className="border-b border-[var(--rule)] py-3" data-testid={`refund-payment-${p.payment_id}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <span className="font-plex text-[14px]">
          {formatDate(p.paid_at)} · {PLAN_LABEL[p.plan] || p.plan || 'Unknown plan'}
          <span className="text-[var(--text-muted)]"> · {p.payment_id}</span>
        </span>
        <span className="flex items-center gap-5">
          <span className="font-plex text-[14px] tabular-nums">
            {formatCurrency(p.amount, p.currency)}
            {refunded && (
              <span className="text-[var(--accent-ink)]">
                {' '}· {p.refundable === 0 ? 'refunded in full' : `${formatCurrency(p.amount_refunded, p.currency)} refunded`}
              </span>
            )}
          </span>
          {p.is_razorpay && p.refundable > 0 && !open && (
            <button type="button" className={quiet} onClick={onOpen} data-testid="refund-open">Refund…</button>
          )}
        </span>
      </div>
      {open && <RefundForm payment={p} onDone={onDone} onAuthError={onAuthError} />}
    </li>
  );
};

export const RefundsPanel = ({ onAuthError }) => {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [payments, setPayments] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [done, setDone] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState('');

  const loadRecent = useCallback(async () => {
    try {
      setRecent((await adminFetch('/api/admin/refunds/recent')).refunds);
    } catch (e) {
      if (e instanceof AdminAuthError) onAuthError?.();
    }
  }, [onAuthError]);

  const find = useCallback(async (term) => {
    const t = (term || '').trim();
    if (!t) return;
    setError(''); setDone(null); setOpenId(null);
    try {
      const data = await adminFetch(`/api/admin/refunds/lookup?q=${encodeURIComponent(t)}`);
      setPayments(data.payments);
      setParams({ q: t }, { replace: true });
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not look that up.');
    }
  }, [onAuthError, setParams]);

  useEffect(() => { loadRecent(); }, [loadRecent]);
  useEffect(() => { if (params.get('q')) find(params.get('q')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDone = async (res) => {
    setOpenId(null);
    if (!res) return;
    setDone(res);
    await find(q);
    setDone(res);
    loadRecent();
  };

  return (
    <div className="max-w-[860px]">
      <form onSubmit={(e) => { e.preventDefault(); find(q); }} className="flex flex-wrap items-end gap-5 mb-2">
        <label>
          <span className={label}>Reader’s email or payment ID</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name@domain.com or pay_…"
            className={`${field} block mt-1 w-[300px]`} data-testid="refund-search" />
        </label>
        <button type="submit" className={primary} data-testid="refund-find">Find payments</button>
      </form>
      <p className="font-plex text-[13px] text-[var(--text-muted)] mb-8 max-w-[70ch]">
        The money goes back to the card or account they paid with, usually within 5 to 7 working days. Paying twice
        and paying the new-reader price as a returning member are refunded automatically.
      </p>

      {error && <p className="font-plex text-[13px] text-[var(--accent-ink)] mb-4">{error}</p>}
      {done && (
        <p className="font-plex text-[14px] mb-6" data-testid="refund-done">
          Refunded {done.display}.{done.access ? ` ${done.access}` : ''}{done.emailed ? ' We emailed them.' : ''}
        </p>
      )}

      {payments && (
        <section className="mb-12">
          {payments.length === 0 ? (
            <p className="font-plex text-[14px] text-[var(--text-muted)]">No payments found for {q.trim()}.</p>
          ) : (
            <ul>
              {payments.map((p) => (
                <PaymentRow key={p.payment_id} p={p} open={openId === p.payment_id}
                  onOpen={() => { setOpenId(p.payment_id); setDone(null); }} onDone={onDone} onAuthError={onAuthError} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <p className={`${label} mb-3`}>Recent refunds, last 60 days</p>
        {!recent ? (
          <p className="font-plex text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="font-plex text-[13px] text-[var(--text-muted)]">None yet.</p>
        ) : (
          <ul data-testid="refunds-recent">
            {recent.map((r) => (
              <li key={`${r.payment_id}-${r.at}`} className="border-b border-[var(--rule)] py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="font-plex text-[14px]">
                  <button type="button" className="hover:underline underline-offset-4" onClick={() => { setQ(r.email); find(r.email); }}>{r.email}</button>
                  <span className="text-[var(--text-muted)]"> · {r.reason} · {BY_LABEL[r.by] || r.by}</span>
                </span>
                <span className="font-plex text-[13px] tabular-nums">
                  {formatCurrency(r.amount, r.currency)}
                  <span className={r.status === 'failed' ? 'text-[var(--accent-ink)]' : 'text-[var(--text-muted)]'}> · {STATUS_LABEL[r.status] || r.status}</span>
                  <span className="text-[var(--text-muted)]"> · {r.at ? formatDateTime(r.at) : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default RefundsPanel;
