import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

/* Today: phone notifications for new stories (backend push.py). How many
   phones have them on, the last story sent, a pause switch, and a test
   send to your own phone. */
export const PushPanel = ({ onAuthError, label }) => {
  const [s, setS] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (e) => {
    if (e instanceof AdminAuthError) { onAuthError?.(); return; }
    setNote(e.message || 'That didn’t work.');
  };
  useEffect(() => { adminFetch('/api/admin/push').then(setS).catch(() => {}); }, []);
  if (!s) return null;

  const togglePause = async () => {
    setBusy(true); setNote('');
    try {
      const r = await adminFetch('/api/admin/push/pause', { method: 'POST', body: JSON.stringify({ paused: !s.paused }) });
      setS({ ...s, paused: r.paused });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setNote('');
    try {
      const r = await adminFetch('/api/admin/push/test', { method: 'POST', body: JSON.stringify({}) });
      setNote(r.sent ? `Sent to ${r.sent} ${r.sent === 1 ? 'phone' : 'phones'} signed in as ${r.email}.` : 'It didn’t reach your phone. Turn notifications off and on again at /app.');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const link = 'font-plex text-[13px] text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] disabled:opacity-50';

  return (
    <section className="mb-10" data-testid="today-push">
      <p className={label}>Phone notifications</p>
      <p className="font-plex text-[14px]">
        {s.devices} {s.devices === 1 ? 'phone has' : 'phones have'} notifications on.
        {s.last ? ` Last sent: “${s.last.title}” to ${s.last.sent}, ${formatDateTime(s.last.at)}.` : ' Nothing sent yet.'}
        {s.paused && <span className="text-[var(--accent-ink)]"> Paused: new stories won’t send.</span>}
      </p>
      <div className="flex flex-wrap gap-5 mt-2">
        <button type="button" onClick={togglePause} disabled={busy} className={link} data-testid="push-pause">
          {s.paused ? 'Resume notifications' : 'Pause notifications'}
        </button>
        <button type="button" onClick={test} disabled={busy} className={link} data-testid="push-test">Send a test to my phone</button>
      </div>
      {note && <p className="font-plex text-[13px] mt-2" role="status">{note}</p>}
    </section>
  );
};

export default PushPanel;
