import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout, Overline } from '../components/MockupLayout';

const API = process.env.REACT_APP_BACKEND_URL;
const ADMIN_EMAIL = 'hello@venkatananth.me';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const CommentsModerationMockup = () => {
  const { user } = useAuth();
  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;

  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const getKey = () => window.localStorage.getItem('tsop_admin_key') || '';

  const load = async (keyOverride) => {
    const key = keyOverride || getKey();
    if (!key) {
      const k = window.prompt('Paste your TSOP ADMIN_KEY. We\'ll remember it on this device.');
      if (!k) return;
      window.localStorage.setItem('tsop_admin_key', k.trim());
      return load(k.trim());
    }
    setLoading(true);
    setError('');
    try {
      const headers = { 'X-Admin-Key': key };
      const [pendingRes, approvedRes] = await Promise.all([
        fetch(`${API}/api/comments/pending`, { headers }),
        fetch(`${API}/api/comments/approved`, { headers }),
      ]);
      if (pendingRes.status === 403 || approvedRes.status === 403) {
        window.localStorage.removeItem('tsop_admin_key');
        throw new Error('Admin key rejected. Reload to try again.');
      }
      if (!pendingRes.ok) throw new Error(`Load failed (${pendingRes.status})`);
      if (!approvedRes.ok) throw new Error(`Load failed (${approvedRes.status})`);
      setPending(await pendingRes.json());
      setApproved(await approvedRes.json());
    } catch (err) {
      setError(err.message || 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const moderate = async (id, action) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/comments/${id}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': getKey() },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`${action} failed (${res.status})`);
      setPending((prev) => prev.filter((c) => c.id !== id));
      if (action === 'approve') load(getKey());
    } catch (err) {
      setError(err.message || 'Could not update that comment.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteComment = async (id) => {
    if (!window.confirm('Delete this comment permanently? This can\'t be undone.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': getKey() },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setApproved((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message || 'Could not delete that comment.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <MockupLayout testId="page-comments-moderation" seo={{ title: 'Comments', path: '/admin/comments', noindex: true }}>
        <div className="max-w-[860px] mx-auto px-6 lg:px-0 pt-24 pb-32">
          <p className="font-plex text-[15px] text-[var(--text-muted)]">
            Not authorized.
          </p>
        </div>
      </MockupLayout>
    );
  }

  return (
    <MockupLayout testId="page-comments-moderation" seo={{ title: 'Comments moderation', path: '/admin/comments', noindex: true }}>
      <div className="max-w-[860px] mx-auto px-6 lg:px-0 pt-10 lg:pt-12 pb-32">
        <Overline className="block mb-3">Admin</Overline>
        <h1 className="font-editorial font-semibold text-[2rem] lg:text-[2.5rem] leading-tight mb-8">
          Comments
        </h1>

        {loading && (
          <p className="font-plex text-[14px] text-[var(--text-label)]">Loading…</p>
        )}
        {error && (
          <p className="font-plex text-[14px] text-[var(--accent-burgundy)] mb-6">{error}</p>
        )}

        {!loading && (
          <>
            <h2 className="font-plex text-[13px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-4">
              Pending review {pending.length > 0 ? `(${pending.length})` : ''}
            </h2>
            {pending.length === 0 && (
              <p className="font-plex text-[14px] text-[var(--text-label)] mb-10">
                Nothing waiting on review.
              </p>
            )}
            {pending.length > 0 && (
              <ul className="mb-12">
                {pending.map((c) => (
                  <li
                    key={c.id}
                    data-testid={`pending-comment-${c.id}`}
                    className="py-6 border-b border-[var(--rule)] first:border-t"
                  >
                    <p className="font-plex text-[12px] text-[var(--text-label)] mb-2">
                      <span className="font-bold text-[var(--text)]">{c.author_name}</span>
                      {' · '}
                      {c.author_email}
                      {' · '}
                      on{' '}
                      <Link to={`/${c.post_slug}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[4px] decoration-1 hover:decoration-2">
                        {c.post_slug}
                      </Link>
                      {' · '}
                      {longDate(c.created_at)}
                      {c.parent_id && (
                        <>
                          {' · '}
                          <span className="uppercase tracking-[0.05em]">reply</span>
                        </>
                      )}
                    </p>
                    {c.parent_preview && (
                      <p className="font-plex text-[12px] text-[var(--text-label)] mb-2 pl-3 border-l border-[var(--rule)]">
                        Replying to <span className="font-bold">{c.parent_preview.author_name}</span>:{' '}
                        &ldquo;{c.parent_preview.body}{c.parent_preview.body?.length >= 140 ? '…' : ''}&rdquo;
                      </p>
                    )}
                    <p className="font-plex text-[15px] leading-relaxed text-[var(--text)] whitespace-pre-wrap mb-4">
                      {c.body}
                    </p>
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        onClick={() => moderate(c.id, 'approve')}
                        disabled={busyId === c.id}
                        data-testid={`approve-${c.id}`}
                        className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-[5px] decoration-1 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => moderate(c.id, 'reject')}
                        disabled={busyId === c.id}
                        data-testid={`reject-${c.id}`}
                        className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--text-label)] hover:text-[var(--text)] hover:underline underline-offset-[5px] decoration-1 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="font-plex text-[13px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-4">
              Live {approved.length > 0 ? `(${approved.length})` : ''}
            </h2>
            {approved.length === 0 && (
              <p className="font-plex text-[14px] text-[var(--text-label)]">
                Nothing published yet.
              </p>
            )}
            {approved.length > 0 && (
              <ul>
                {approved.map((c) => (
                  <li
                    key={c.id}
                    data-testid={`live-comment-${c.id}`}
                    className="py-6 border-b border-[var(--rule)] first:border-t"
                  >
                    <p className="font-plex text-[12px] text-[var(--text-label)] mb-2">
                      <span className="font-bold text-[var(--text)]">{c.author_name}</span>
                      {' · '}
                      {c.author_email}
                      {' · '}
                      on{' '}
                      <Link to={`/${c.post_slug}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[4px] decoration-1 hover:decoration-2">
                        {c.post_slug}
                      </Link>
                      {' · '}
                      {longDate(c.created_at)}
                      {c.parent_id && (
                        <>
                          {' · '}
                          <span className="uppercase tracking-[0.05em]">reply</span>
                        </>
                      )}
                    </p>
                    <p className="font-plex text-[15px] leading-relaxed text-[var(--text)] whitespace-pre-wrap mb-4">
                      {c.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      disabled={busyId === c.id}
                      data-testid={`delete-${c.id}`}
                      className="font-plex text-[13px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-[5px] decoration-1 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </MockupLayout>
  );
};

export default CommentsModerationMockup;
