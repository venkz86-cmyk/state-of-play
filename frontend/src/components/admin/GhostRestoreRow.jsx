import { useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatCurrency, formatDate } from '../../lib/format';

const PLAN_NAMES = {
  standard: 'Annual', renewal: 'Renewal', 'trial-upgrade': 'Upgrade from The Ten',
  student: 'Student', unknown: 'Annual (older payment)',
};

/* One row of "Paying, but Ghost shows free" on Today. "Restore in Ghost"
   first asks the server what it would do (GET /api/admin/ghost-restore):
   the payment their access comes from, and the access dates. Only after
   Venkat confirms does it comp them in Ghost until that access end date
   (POST), and it reports what Ghost itself shows afterwards. The date
   always comes from the server, never from this page. */
export const GhostRestoreRow = ({ row, onAuthError }) => {
  const [step, setStep] = useState('idle'); // idle | loading | confirm | saving | done | error
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const fail = (e) => {
    if (e instanceof AdminAuthError) { onAuthError?.(); return; }
    setError(e.message || 'Something went wrong.'); setStep('error');
  };

  const preview = async () => {
    setStep('loading'); setError('');
    try {
      const p = await adminFetch(`/api/admin/ghost-restore?email=${encodeURIComponent(row.email)}`);
      setPlan(p);
      if (!p.ok) { setError(p.problem || 'This member can’t be restored.'); setStep('error'); return; }
      setStep('confirm');
    } catch (e) { fail(e); }
  };

  const restore = async () => {
    setStep('saving'); setError('');
    try {
      const r = await adminFetch('/api/admin/ghost-restore', {
        method: 'POST', body: JSON.stringify({ email: row.email, access_to: plan.access_to }),
      });
      setResult(r); setStep('done');
    } catch (e) { fail(e); }
  };

  const pay = plan?.payment;
  const btn = 'font-plex text-[13px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)] disabled:opacity-50';

  return (
    <li className="border-b border-[var(--rule)] py-2.5" data-testid={`ghost-restore-${row.email}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-plex text-[14px]">{row.name || row.email} <span className="text-[var(--text-muted)]">({row.email})</span></span>
        <span className="flex items-center gap-4">
          <span className="font-plex text-[13px] text-[var(--text-muted)]">
            access to {row.restore_to_date ? formatDate(row.restore_to_date) : 'unknown (no payment on record)'}
          </span>
          {step === 'idle' && row.restore_to_date && (
            <button type="button" className={btn} onClick={preview} data-testid="ghost-restore-open">Restore in Ghost</button>
          )}
          {step === 'loading' && <span className="font-plex text-[13px] text-[var(--text-muted)]">Checking…</span>}
        </span>
      </div>

      {(step === 'confirm' || step === 'saving') && pay && (
        <div className="mt-3 mb-1 border border-[var(--rule)] p-4 font-plex text-[14px] max-w-[60ch]" data-testid="ghost-restore-confirm">
          <p className="mb-2">
            Their access comes from: <strong>{PLAN_NAMES[pay.plan] || pay.plan}</strong>, {formatCurrency(pay.amount, pay.currency)},
            paid {formatDate(pay.paid_at)}.
          </p>
          {/* A renewal paid before the last year ended starts when that year
              ends (no days lost), so the dates differ from the payment's. */}
          {new Date(pay.access_from) - new Date(pay.paid_at) > 86400000 ? (
            <p className="mb-2" data-testid="ghost-restore-early">
              They renewed before their last year ended on <strong>{formatDate(pay.access_from)}</strong>, so this year
              runs from then to <strong>{formatDate(plan.access_to)}</strong>.
            </p>
          ) : (
            <p className="mb-2">
              Access from <strong>{formatDate(pay.access_from)}</strong> to <strong>{formatDate(plan.access_to)}</strong>.
            </p>
          )}
          <p className="mb-4 text-[var(--text-muted)]">Ghost shows them as {plan.ghost_status} now.</p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button" onClick={restore} disabled={step === 'saving'} data-testid="ghost-restore-confirm-button"
              className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-10 px-5 disabled:opacity-60"
            >
              {step === 'saving' ? 'Restoring…' : `Comp in Ghost until ${formatDate(plan.access_to)}`}
            </button>
            <button type="button" className={btn} onClick={() => setStep('idle')} disabled={step === 'saving'}>Cancel</button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <p className="mt-2 font-plex text-[13px]" data-testid="ghost-restore-result">
          {result.ok
            ? `Done. Ghost now shows them comped until ${formatDate((result.ghost_tier_ends || [])[0] || result.access_to)}.`
            : `Ghost took the change but doesn’t look right: status ${result.ghost_status || 'unknown'}, comp ends ${(result.ghost_tier_ends || []).map(formatDate).join(', ') || 'none'}. Check them in Ghost Admin.`}
        </p>
      )}
      {step === 'error' && (
        <p className="mt-2 font-plex text-[13px] text-[var(--accent-ink)]" role="alert" data-testid="ghost-restore-error">
          {error} <button type="button" className={btn} onClick={() => setStep('idle')}>Close</button>
        </p>
      )}
    </li>
  );
};

export default GhostRestoreRow;
