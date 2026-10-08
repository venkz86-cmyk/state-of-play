import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

// The Left Field's Substack readers, for the ₹2,499 offer: upload
// Substack's subscriber export and everyone who signed up before
// October 6 can pay that rate at /signup?offer=left-field
// (payments.import_left_field_readers, session_auth.early_rate_for_email).
const n = (x) => (x ?? 0).toLocaleString('en-IN');

export const LeftFieldReadersPanel = ({ onAuthError }) => {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    try {
      setStatus(await adminFetch('/api/admin/left-field-readers/status'));
    } catch (e) {
      if (e instanceof AdminAuthError) onAuthError?.();
    }
  };

  useEffect(() => { loadStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Takes current and past TSOP subscribers off the list
  // (admin_dashboard.audit_left_field_readers). Runs after every upload.
  const runAudit = async () => {
    const data = await adminFetch('/api/admin/left-field-readers/audit', { method: 'POST' });
    setAudit(data);
    setStatus((s) => ({ ...s, total: data.total }));
  };

  const checkOnly = async () => {
    setBusy(true); setError(''); setResult(null); setAudit(null);
    try {
      await runAudit();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Could not check the list against subscribers.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); setResult(null); setAudit(null);
    try {
      const csv = await file.text();
      const data = await adminFetch('/api/admin/left-field-readers/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setResult(data);
      setStatus((s) => ({ ...s, total: data.total, last_import_at: new Date().toISOString() }));
      await runAudit();
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[640px]" data-testid="left-field-readers">
      <p className="font-plex text-[14px] text-[var(--text-muted)] mb-5">
        Upload the subscriber export from Substack (Settings → Exports). Readers who signed up before October 6 can
        then subscribe at ₹2,499 + GST until October 31 through stateofplay.club/signup?offer=left-field. Uploading a
        newer export only adds the new emails.
      </p>
      {status?.total ? (
        <p className="font-plex text-[13px] text-[var(--text)] mb-4" data-testid="left-field-total">
          {n(status.total)} readers on the list, last upload {formatDateTime(status.last_import_at)}.
        </p>
      ) : (
        <p className="font-plex text-[13px] text-[var(--text)] mb-4" data-testid="left-field-total">Nobody on the list yet.</p>
      )}
      {result && (
        <p className="font-plex text-[13px] text-[var(--text)] mb-4" data-testid="left-field-result">
          Added {n(result.added)}. {n(result.already_listed)} were already on the list.
          {result.too_recent ? ` ${n(result.too_recent)} signed up on or after October 6 and were left out.` : ''}
          {' '}{n(result.total)} readers on the list now.
          {result.date_column
            ? ` Signup dates came from the “${result.date_column}” column.`
            : ' The file had no signup dates, so everyone in it was added.'}
          {result.source_column
            ? ` Left out ${n(result.imported)} readers imported from Ghost (the “${result.source_column}” column)${result.imported_removed ? `, and took ${n(result.imported_removed)} of them off the list` : ''}.`
            : ' The file had no source column, so nobody was left out as imported.'}
        </p>
      )}
      {audit && (
        <p className="font-plex text-[13px] text-[var(--text)] mb-4" data-testid="left-field-audit">
          Checked against TSOP subscribers: removed {n(audit.removed_subscribers)} current or past
          subscriber{audit.removed_subscribers === 1 ? '' : 's'}. {n(audit.total)} readers on the list now:{' '}
          {n(audit.substack_only)} on Substack only, {n(audit.ghost_free_before_cutover)} free Ghost readers from before
          October 6{audit.ghost_free_after_cutover ? ` and ${n(audit.ghost_free_after_cutover)} who joined Ghost after` : ''}.
        </p>
      )}
      {error && <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mb-3">{error}</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
        <label className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] underline underline-offset-4 hover:decoration-2 cursor-pointer">
        {busy ? 'Working…' : 'Upload Substack export →'}
        <input type="file" accept=".csv,text/csv,text/plain" onChange={upload} disabled={busy} className="sr-only" data-testid="left-field-file" />
      </label>
      <button
        type="button" onClick={checkOnly} disabled={busy} data-testid="left-field-audit-run"
        className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] disabled:opacity-60"
      >
        Check against subscribers
      </button>
      </div>
    </div>
  );
};

export default LeftFieldReadersPanel;
