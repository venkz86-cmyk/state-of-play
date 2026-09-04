import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime } from '../../lib/format';
import { useCountDelta } from '../../lib/useCountDelta';

// Replaces the old /admin/comments page's hand-rolled <ul>/<li> lists
// with the same DataTable every other panel uses. Same endpoints,
// migrated in Phase 1 to the shared admin-session/X-Admin-Key gate.
export const CommentsPanel = ({ onAuthError }) => {
  const [pending, setPending] = useState(null);
  const [approved, setApproved] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const [p, a] = await Promise.all([
        adminFetch('/api/comments/pending'),
        adminFetch('/api/comments/approved'),
      ]);
      setPending(p);
      setApproved(a);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load comments.');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const moderate = async (id, action) => {
    setBusyId(id);
    try {
      await adminFetch(`/api/comments/${id}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not update that comment.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteComment = async (id) => {
    if (!window.confirm("Delete this comment permanently? This can't be undone.")) return;
    setBusyId(id);
    try {
      await adminFetch(`/api/comments/${id}`, { method: 'DELETE' });
      setApproved((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not delete that comment.');
    } finally {
      setBusyId(null);
    }
  };

  // Above the early returns below so this hook always runs (Rules of
  // Hooks) -- null until `pending` loads, matching useCountDelta's own
  // no-op-on-null handling.
  const pendingDelta = useCountDelta('tsop_admin_comments_pending_count', pending?.length ?? null);

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!pending || !approved) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const bodyPreview = (body) => (body && body.length > 100 ? `${body.slice(0, 100)}…` : body);

  const pendingColumns = [
    { key: 'post_slug', label: 'Story', sortable: true },
    { key: 'author_name', label: 'Author', sortable: true, render: (c) => `${c.author_name}${c.parent_id ? ' (reply)' : ''}` },
    { key: 'body', label: 'Comment', render: (c) => bodyPreview(c.body) },
    { key: 'created_at', label: 'Submitted', sortable: true, render: (c) => formatDateTime(c.created_at) },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => moderate(c.id, 'approve')}
            disabled={busyId === c.id}
            className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => moderate(c.id, 'reject')}
            disabled={busyId === c.id}
            className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--text-muted)] hover:text-[var(--text)] hover:underline underline-offset-4 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  const approvedColumns = [
    { key: 'post_slug', label: 'Story', sortable: true },
    { key: 'author_name', label: 'Author', sortable: true },
    { key: 'body', label: 'Comment', render: (c) => bodyPreview(c.body) },
    { key: 'created_at', label: 'Posted', sortable: true, render: (c) => formatDateTime(c.created_at) },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <button
          type="button"
          onClick={() => deleteComment(c.id)}
          disabled={busyId === c.id}
          className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4 disabled:opacity-60"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-8">
        <KPITile
          label="Pending review"
          value={pending.length}
          accent={pending.length > 0}
          sublabel={pendingDelta ? `+${pendingDelta} since last visit` : undefined}
        />
        <KPITile label="Live" value={approved.length} bordered />
      </div>

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-3">
        Pending review
      </p>
      <DataTable
        columns={pendingColumns}
        rows={pending}
        rowKey={(c) => c.id}
        emptyMessage="Nothing waiting on review."
      />

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mt-10 mb-3">
        Live
      </p>
      <DataTable
        columns={approvedColumns}
        rows={approved}
        rowKey={(c) => c.id}
        searchKeys={['author_name', 'post_slug']}
        searchPlaceholder="Search by author or story…"
        emptyMessage="Nothing published yet."
      />
    </div>
  );
};

export default CommentsPanel;
