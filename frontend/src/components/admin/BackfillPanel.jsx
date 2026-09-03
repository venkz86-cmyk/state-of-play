import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

// One-time (safe to re-run) pull of historical payments from Razorpay's
// own API -- everyone who paid before the ledger existed only has their
// payment history there. Lives as a small panel, not its own top-level
// tab, since it's an occasional action, not something browsed daily.
export const BackfillPanel = ({ onAuthError }) => {
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    try {
      const data = await adminFetch('/api/admin/payments/backfill/status');
      setStatus(data);
    } catch (e) {
      if (e instanceof AdminAuthError) onAuthError?.();
    }
  };

  useEffect(() => { loadStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runBackfill = async () => {
    setRunning(true);
    setError('');
    try {
      const result = await adminFetch('/api/admin/payments/backfill', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setStatus({ last_run_at: new Date().toISOString(), ...result });
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Backfill failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border border-[var(--rule)] p-6 max-w-[480px]">
      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
        Historical payments
      </p>
      {status?.last_run_at ? (
        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-4">
          Last run {formatDateTime(status.last_run_at)} — {status.recorded ?? 0} recorded,{' '}
          {status.skipped_existing ?? 0} already known
          {status.unmatched_email_count ? `, ${status.unmatched_email_count} with no email` : ''}.
        </p>
      ) : (
        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-4">
          Never run. Only sees whichever mode (test or live) Razorpay's configured keys are in — pulls what's already
          there, safe to re-run any time.
        </p>
      )}
      {error && (
        <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mb-3">{error}</p>
      )}
      <button
        type="button"
        onClick={runBackfill}
        disabled={running}
        className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] underline underline-offset-4 hover:decoration-2 disabled:opacity-60"
      >
        {running ? 'Running…' : 'Run backfill →'}
      </button>
    </div>
  );
};

export default BackfillPanel;
