import { useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate } from '../../lib/format';

const PLAN_LABEL = { standard: 'Annual', student: 'Student', trial: 'The Ten', renewal: 'Renewal' };

// For a member who paid in Razorpay with a different email than the one
// they sign in with: moves those payments onto their account
// (POST /api/admin/payments/link-email), so their end date, renewal
// emails and this dashboard all see them.
export const LinkPaymentEmail = ({ onAuthError, onLinked }) => {
  const [paidWith, setPaidWith] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const link = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await adminFetch('/api/admin/payments/link-email', {
        method: 'POST',
        body: JSON.stringify({ paid_with: paidWith.trim(), account: account.trim() }),
      });
      setResult(data);
      if (data.moved) await onLinked?.();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Could not link those emails.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[13px] py-1 w-[240px] focus:outline-none focus:border-[var(--accent-burgundy)]';

  return (
    <form onSubmit={link} data-testid="link-payment-email" className="border-y border-[var(--rule)] py-5 mb-6">
      <p className="font-editorial italic text-lg mb-1">Link a payment email</p>
      <p className="font-plex text-[13px] text-[var(--text-muted)] mb-4 max-w-[70ch]">
        For someone who paid in Razorpay with a different email than the one they sign in with. Their payments
        move onto their account, so their renewal date and emails work. If nothing is found, run the import of
        past payments on the Overview tab first.
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <label className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">
          Paid with
          <input type="email" required value={paidWith} onChange={(e) => setPaidWith(e.target.value)}
            placeholder="name@gmail.com" className={`block mt-1 normal-case tracking-normal ${field}`} data-testid="link-paid-with" />
        </label>
        <label className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">
          Account email
          <input type="email" required value={account} onChange={(e) => setAccount(e.target.value)}
            placeholder="name@domain.com" className={`block mt-1 normal-case tracking-normal ${field}`} data-testid="link-account" />
        </label>
        <button type="submit" disabled={busy} data-testid="link-submit"
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 disabled:opacity-50">
          {busy ? 'Linking…' : 'Link'}
        </button>
      </div>
      {error && <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mt-3">{error}</p>}
      {result && (
        <div data-testid="link-result" className="font-plex text-[13px] mt-3">
          {result.moved
            ? <p>Moved {result.moved} payment{result.moved === 1 ? '' : 's'} onto {account.trim().toLowerCase()}:</p>
            : <p className="text-[var(--accent-burgundy)]">No payments found under {paidWith.trim().toLowerCase()}. Run the import of past payments on the Overview tab, then try again.</p>}
          {(result.payments || []).map((p) => (
            <p key={p.payment_id} className="text-[var(--text-muted)]">
              {formatDate(p.razorpay_created_at)} · {formatCurrency(p.amount, p.currency)} · {PLAN_LABEL[p.plan] || p.plan || 'Unknown plan'}
            </p>
          ))}
        </div>
      )}
    </form>
  );
};

export default LinkPaymentEmail;
