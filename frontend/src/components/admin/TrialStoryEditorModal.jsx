import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDate } from '../../lib/format';

/* TrialStoryEditorModal -- add/remove stories from a Trial ("The Ten")
   snapshot. Two scopes, chosen by whether `email` is passed:

   - email given: one already-signed-up member's own permanent
     snapshot_slugs (GET/{email}/stories, add-slug/remove-slug with
     {email, slug} bodies). Exists for the rare case a story
     snapshotted while paid/members later gets unlocked to free (an
     editorial decision this module has no visibility into when it
     happens) -- trials_drift_check flags it, this fixes it for that
     one member. Real example: Sanjog Gupta's JioStar profile.
   - email omitted: the global admin-curated list every NEW signup's
     permanent snapshot is copied from (GET/POST .../the-ten...,
     {slug}-only bodies). Doesn't touch anyone already signed up --
     only what a future signup gets.

   Both scopes share the exact same current-list/remove,
   filter/candidates-list/add UI -- only the data source and endpoint
   paths differ. Two plain POSTs (add/remove), not a combined "swap":
   a rare manual action, no reason to special-case it over two
   clicks. */
export const TrialStoryEditorModal = ({ email, open, onOpenChange, onChanged }) => {
  const isGlobal = !email;
  const detailPath = isGlobal ? '/api/admin/trials/the-ten' : `/api/admin/trials/${encodeURIComponent(email)}/stories`;
  const addPath = isGlobal ? '/api/admin/trials/the-ten/add' : '/api/admin/trials/add-slug';
  const removePath = isGlobal ? '/api/admin/trials/the-ten/remove' : '/api/admin/trials/remove-slug';
  const bodyFor = (slug) => JSON.stringify(isGlobal ? { slug } : { email, slug });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [filter, setFilter] = useState('');
  const [busySlug, setBusySlug] = useState('');

  const load = async () => {
    if (!isGlobal && !email) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch(detailPath);
      setCurrent(data.current || []);
      setCandidates(data.candidates || []);
    } catch (e) {
      if (e instanceof AdminAuthError) throw e;
      setError(e.message || 'Could not load these stories.');
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
      await adminFetch(removePath, { method: 'POST', body: bodyFor(slug) });
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
      await adminFetch(addPath, { method: 'POST', body: bodyFor(slug) });
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
        <DialogTitle className="font-editorial text-xl">
          {isGlobal ? 'The Ten: default for new signups' : `The Ten: ${email}`}
        </DialogTitle>
        <DialogDescription className="font-plex text-[13px] text-[var(--text-muted)]">
          {isGlobal
            ? "What a brand-new signup's permanent Ten is copied from. Doesn't change anyone already signed up."
            : "This member's permanent story snapshot. Remove one that's drifted to free, add a real replacement from below."}
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
                <p className="font-plex text-[13px] text-[var(--text-muted)]">
                  {isGlobal ? 'Nothing curated yet -- new signups fall back to the ten most recent premium stories.' : 'No stories snapshotted.'}
                </p>
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
                placeholder="Filter premium stories..."
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
