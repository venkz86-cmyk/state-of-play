import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';

// The Student plan's review queue -- replaces "remember to check Tally,
// then hand-type an email" with a Slack ping on arrival (see
// student_applications.py) and a one-click Approve here, which sends the
// right country's payment link automatically. The actual ID judgment
// still happens by eye, in this panel, before clicking Approve -- that
// part was never meant to be automated.

const FILTERS = ['pending', 'approved', 'rejected', 'all'];

export const StudentApplicationsPanel = ({ onAuthError }) => {
  const [filter, setFilter] = useState('pending');
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async (statusFilter) => {
    try {
      const data = await adminFetch(`/api/admin/student-applications?status_filter=${statusFilter}`);
      setApplications(data.applications);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load applications.');
    }
  };

  useEffect(() => { setApplications(null); load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (application, country) => {
    const label = country === 'IN' ? 'India' : 'International';
    if (!window.confirm(`Approve ${application.name || application.email} and email them the ${label} payment link now?`)) return;
    setBusyId(application.application_id);
    try {
      await adminFetch(`/api/admin/student-applications/${application.application_id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ country }),
      });
      await load(filter);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not approve this application.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (application) => {
    if (!window.confirm(`Reject ${application.name || application.email}? No email is sent -- follow up yourself if you want to explain why.`)) return;
    setBusyId(application.application_id);
    try {
      await adminFetch(`/api/admin/student-applications/${application.application_id}/reject`, { method: 'POST' });
      await load(filter);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not reject this application.');
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!applications) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  const columns = [
    {
      key: 'name', label: 'Applicant', sortable: true,
      render: (a) => (
        <div>
          <p>{a.name || '(no name found)'}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{a.email || '(no email found — check raw answers)'}</p>
        </div>
      ),
    },
    { key: 'college', label: 'College', sortable: true, render: (a) => a.college || '—' },
    {
      key: 'id_photo_url', label: 'ID photo',
      render: (a) => a.id_photo_url ? (
        <a
          href={a.id_photo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent-burgundy)] underline underline-offset-4"
        >
          View →
        </a>
      ) : (
        <span className="text-[var(--text-muted)]">No file found</span>
      ),
    },
    { key: 'created_at', label: 'Applied', sortable: true, render: (a) => formatDateTime(a.created_at) },
    {
      key: 'actions', label: '', align: 'right',
      render: (a) => {
        if (a.status !== 'pending') {
          return (
            <span className="text-[12px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
              {a.status}{a.decided_country ? ` · ${a.decided_country}` : ''}
            </span>
          );
        }
        return (
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => approve(a, 'IN')}
              disabled={busyId === a.application_id}
              className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--text)] hover:text-[var(--accent-burgundy)] underline underline-offset-4 disabled:opacity-60"
            >
              Approve · IN
            </button>
            <button
              type="button"
              onClick={() => approve(a, 'INTL')}
              disabled={busyId === a.application_id}
              className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--text)] hover:text-[var(--accent-burgundy)] underline underline-offset-4 disabled:opacity-60"
            >
              Approve · Intl
            </button>
            <button
              type="button"
              onClick={() => reject(a)}
              disabled={busyId === a.application_id}
              className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-6">
        <KPITile label="Pending review" value={pendingCount} accent={pendingCount > 0} />
        <KPITile label={`${filter[0].toUpperCase()}${filter.slice(1)} shown`} value={applications.length} bordered />
      </div>

      <div className="flex gap-6 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`font-plex text-[13px] pb-1 border-b-2 capitalize transition-colors ${
              filter === f
                ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={applications}
        rowKey={(a) => a.application_id}
        searchKeys={['name', 'email', 'college']}
        searchPlaceholder="Search by name, email or college…"
        emptyMessage="No applications in this view."
      />
    </div>
  );
};

export default StudentApplicationsPanel;
