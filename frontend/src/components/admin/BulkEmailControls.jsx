import { useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';

// Shared by the Renewals panel (lapsed members) and the Nominated Readers
// panel (expired nominees): POSTs {emails} or {test_to} to an admin send
// endpoint that re-checks who qualifies and returns {sent, skipped}.
export const sendAdminEmails = async (endpoint, body) => adminFetch(endpoint, {
  method: 'POST',
  body: JSON.stringify(body),
});

export const summarise = (res) => {
  if (!res) return '';
  if (res.error) return res.error;
  if (res.test) return res.sent ? 'Test sent.' : 'The test email failed to send.';
  const skipped = res.skipped || [];
  return `Sent ${res.sent}.${skipped.length ? ` Skipped ${skipped.length}.` : ''}`;
};

const linkButton = 'font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60';

// "Email all N" (with a confirm step), "Send me a test", and the result
// of the last send, including who was skipped and why.
export const BulkEmailControls = ({
  endpoint, emails, allLabel, confirmText, onSent, onAuthError,
  defaultTestTo = 'venkat@stateofplay.club', result, setResult,
}) => {
  const [testTo, setTestTo] = useState(defaultTestTo);
  const [busy, setBusy] = useState(false);

  const run = async (body) => {
    setBusy(true);
    try {
      const res = await sendAdminEmails(endpoint, body);
      setResult(res);
      if (!body.test_to) await onSent?.();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setResult({ error: e.message || 'Could not send.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-y border-[var(--rule)] py-5 mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <button
          type="button"
          disabled={busy || emails.length === 0}
          data-testid="bulk-send-all"
          onClick={() => { if (window.confirm(confirmText(emails.length))) run({ emails }); }}
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] h-10 px-5 transition-colors disabled:opacity-50"
        >
          {allLabel(emails.length)}
        </button>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            data-testid="bulk-test-to"
            className="bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[13px] py-1 w-[220px] focus:outline-none focus:border-[var(--accent-burgundy)]"
          />
          <button type="button" disabled={busy || !testTo} data-testid="bulk-send-test" onClick={() => run({ test_to: testTo })} className={linkButton}>
            Send me a test
          </button>
        </div>
        {busy && <span className="font-plex text-[13px] text-[var(--text-muted)]">Sending…</span>}
      </div>
      {result && (
        <div data-testid="bulk-result" className="font-plex text-[13px] text-[var(--text)]">
          <p>{summarise(result)}</p>
          {(result.skipped || []).length > 0 && (
            <ul className="mt-1 text-[var(--text-muted)]">
              {result.skipped.map((s) => <li key={s.email}>{s.email}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export const RowSendButton = ({ endpoint, email, label, onSent, onAuthError, setResult }) => {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      data-testid={`row-send-${email}`}
      onClick={async () => {
        if (!window.confirm(`Send to ${email}?`)) return;
        setBusy(true);
        try {
          const res = await sendAdminEmails(endpoint, { emails: [email] });
          setResult(res);
          await onSent?.();
        } catch (e) {
          if (e instanceof AdminAuthError) { onAuthError?.(); return; }
          setResult({ error: e.message || 'Could not send.' });
        } finally {
          setBusy(false);
        }
      }}
      className={linkButton}
    >
      {busy ? 'Sending…' : label}
    </button>
  );
};

// Days since an ISO timestamp, or null.
export const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
