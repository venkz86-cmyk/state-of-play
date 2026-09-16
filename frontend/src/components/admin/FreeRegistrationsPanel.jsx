import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

/* Cleanup panel for junk free (email-gate) signups -- register-free
   creates a real Ghost member, joining the newsletter list, from
   nothing more than a syntax-valid email. A domain-deliverability
   check catches a fake domain (k@g.com) but can't catch a real
   domain with an obviously junk local part (abc@gmail.com). This is
   the fast-cleanup counterpart: list the candidates, delete the junk
   ones in one click instead of hunting through Ghost's own admin UI. */
export const FreeRegistrationsPanel = ({ onAuthError }) => {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const data = await adminFetch('/api/admin/free-registrations');
      setMembers(data.members);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load free registrations.');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (member) => {
    if (!window.confirm(`Delete ${member.email}? This removes them from Ghost entirely, including your newsletter list. Can't be undone.`)) return;
    setBusyId(member.id);
    try {
      await adminFetch('/api/admin/free-registrations/delete', {
        method: 'POST',
        body: JSON.stringify({ member_id: member.id }),
      });
      await load();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not delete that member.');
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!members) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (m) => m.name || '—' },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'reason', label: 'Reason', sortable: true,
      render: (m) => (
        <span className="font-plex text-[11px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
          {m.reason === 'email-gate-signup' ? 'Email gate' : 'No labels'}
        </span>
      ),
    },
    { key: 'created_at', label: 'Signed up', sortable: true, align: 'right', render: (m) => formatDateTime(m.created_at) },
    {
      key: 'actions', label: '', align: 'right',
      render: (m) => (
        <button
          type="button"
          onClick={() => remove(m)}
          disabled={busyId === m.id}
          className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-1 mb-6">
        <KPITile label="Free signups worth a look" value={members.length} />
      </div>

      <p className="font-plex text-[13px] text-[var(--text-muted)] mb-6 max-w-[60ch]">
        Free members with no real labels, either tagged from the email-gate story
        registration or created before that tag existed. Real free members
        (nominated readers, trial, etc.) never show up here.
      </p>

      <DataTable
        columns={columns}
        rows={members}
        rowKey={(m) => m.id}
        searchKeys={['name', 'email']}
        searchPlaceholder="Search by name or email…"
        emptyMessage="Nothing flagged right now."
      />
    </div>
  );
};

export default FreeRegistrationsPanel;
