import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

/* TrialStoryEditorModal -- manual correction for one Trial ("The Ten")
   member's permanent snapshot_slugs. Exists for the rare case a story
   snapshotted while paid/members later gets unlocked to free (an
   editorial decision this module has no visibility into when it
   happens): trials_drift_check flags it, this is where Venkat actually
   fixes it, removing the drifted story and adding a real replacement
   from the candidates list. Two plain POSTs (add-slug/remove-slug), not
   a combined "swap" -- a rare manual action, no reason to special-case
   it over two clicks. */
export const TrialStoryEditorModal = ({ email, open, onOpenChange, onChanged }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [filter, setFilter] = useState('');
  const [busySlug, setBusySlug] = useState('');

  const load = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch(`/api/admin/trials/${encodeURIComponent(email)}/stories`);
      setCurrent(data.current || []);
      setCandidates(data.candidates || []);
    } catch (e) {
      if (e instanceof AdminAuthError) throw e;
      setError(e.message || 'Could not load this member\'s stories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email]);

  const removeSlug = async (slug) => {
    setBusySlug(slug);
    setError('');
    try {
      await adminFetch('/api/admin/trials/remove-slug', { method: 'POST', body: JSON.stringify({ email, slug }) });
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message || 'Could not remove that story.');
    } finally {
      setBusySlug('');
    }
  };

  const addSlug = async (slug) => {
    setBusySlug(slug);
    setError('');
    try {
      await adminFetch('/api/admin/trials/add-slug', { method: 'POST', body: JSON.stringify({ email, slug }) });
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message || 'Could not add that story.');
    } finally {
      setBusySlug('');
    }
  };

  const filteredCandidates = candidates.filter((c) =>
    c.title.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogTitle className="font-editorial text-xl">The Ten: {email}</DialogTitle>
        <DialogDescription className="font-plex text-[13px] text-[var(--text-muted)]">
          This member's permanent story snapshot. Remove one that's drifted to free, add a real
          replacement from below.
        </DialogDescription>

        {error && (
          <p className="font-plex text-[13px] text-[var(--accent-burgundy)]">{error}</p>
        )}

        {loading ? (
          <p className="font-plex text-[13px] text-[var(--text-muted)]">Loading...</p>
        ) : (
          <>
            <div>
              <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">
                Current ({current.length})
              </p>
              {current.length === 0 && (
                <p className="font-plex text-[13px] text-[var(--text-muted)]">No stories snapshotted.</p>
              )}
              <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
                {current.map((story) => (
                  <li key={story.slug} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-plex text-[14px] truncate">{story.title}</p>
                      {story.visibility !== 'paid' && story.visibility !== 'members' && (
                        <p className="font-plex text-[12px] text-[var(--accent-burgundy)]">
                          Now {story.visibility === 'unknown' ? 'unresolved' : story.visibility}, no longer paywalled.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlug(story.slug)}
                      disabled={busySlug === story.slug}
                      className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] underline underline-offset-4 shrink-0 disabled:opacity-60"
                    >
                      {busySlug === story.slug ? '...' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2 mt-2">
                Add a story
              </p>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter recent premium stories..."
                className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-[14px] py-2 mb-3 focus:outline-none focus:border-[var(--accent-burgundy)]"
              />
              <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)] max-h-[240px] overflow-y-auto">
                {filteredCandidates.map((story) => (
                  <li key={story.slug} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-plex text-[14px] truncate">{story.title}</p>
                      <p className="font-plex text-[12px] text-[var(--text-label)]">{formatDate(story.published_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addSlug(story.slug)}
                      disabled={busySlug === story.slug}
                      className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] underline underline-offset-4 shrink-0 disabled:opacity-60"
                    >
                      {busySlug === story.slug ? '...' : 'Add'}
                    </button>
                  </li>
                ))}
                {filteredCandidates.length === 0 && (
                  <li className="py-3 font-plex text-[13px] text-[var(--text-muted)]">No matching stories.</li>
                )}
              </ul>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TrialStoryEditorModal;
