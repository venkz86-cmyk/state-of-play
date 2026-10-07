import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

// The Left Field's Substack readers, for the ₹2,499 offer: upload
// Substack's subscriber export and everyone who signed up before
// 6 October can pay that rate at /signup?offer=left-field
// (payments.import_left_field_readers, session_auth.early_rate_for_email).
const n = (x) => (x ?? 0).toLocaleString('en-IN');

export const LeftFieldReadersPanel = ({ onAuthError }) => {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
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

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const csv = await file.text();
      const data = await adminFetch('/api/admin/left-field-readers/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setResult(data);
      setStatus((s) => ({ ...s, total: data.total, last_import_at: new Date().toISOString() }));
    } catch (err) {
      if (err instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(err.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-[var(--rule)] p-6 max-w-[480px] mt-6" data-testid="left-field-readers">
      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
        Left Field readers
      </p>
      <p className="font-plex text-[13px] text-[var(--text-muted)] mb-3">
        Upload the subscriber export from Substack (Settings → Exports). Readers who signed up before 6 October can
        then subscribe at ₹2,499 + GST until 31 October through stateofplay.club/signup?offer=left-field. Uploading a
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
          {result.too_recent ? ` ${n(result.too_recent)} signed up on or after 6 October and were left out.` : ''}
          {' '}{n(result.total)} readers on the list now.
          {result.date_column
            ? ` Signup dates came from the “${result.date_column}” column.`
            : ' The file had no signup dates, so everyone in it was added.'}
        </p>
      )}
      {error && <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mb-3">{error}</p>}
      <label className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] underline underline-offset-4 hover:decoration-2 cursor-pointer">
        {busy ? 'Uploading…' : 'Upload Substack export →'}
        <input type="file" accept=".csv,text/csv,text/plain" onChange={upload} disabled={busy} className="sr-only" data-testid="left-field-file" />
      </label>
    </div>
  );
};

export default LeftFieldReadersPanel;
