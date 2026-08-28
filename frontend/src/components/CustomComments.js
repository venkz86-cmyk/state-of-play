import { useEffect, useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;
const MAX_BODY_LENGTH = 2000;

const relativeDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* Shared submit form — used for both a new top-level comment and an inline
   reply. Reply mode is just parentId being set; everything else (server
   call, pending-approval confirmation) is identical. */
const CommentForm = ({ postSlug, parentId, user, compact, onSubmitted }) => {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() || !user?.email) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/comments/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_slug: postSlug,
          parent_id: parentId || undefined,
          author_email: user.email,
          author_name: user.name || '',
          body: body.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not submit your comment.');
      }
      setBody('');
      setSubmitted(true);
      if (onSubmitted) onSubmitted();
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <p className="font-plex text-[13px] text-[var(--text-muted)]" data-testid="comment-submitted">
        Submitted — it'll show up here once it's been reviewed.{' '}
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
        >
          {parentId ? 'Add another reply' : 'Add another'}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        rows={compact ? 2 : 3}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
        data-testid={parentId ? `reply-body-input-${parentId}` : 'comment-body-input'}
        disabled={submitting}
        placeholder={parentId ? 'Write a reply…' : 'Add to the conversation…'}
        className="w-full px-4 py-3 bg-transparent border border-[var(--rule)] font-reading text-[15px] focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
        style={{ borderRadius: 'var(--control-radius)', outline: 'none' }}
      />
      <div className="flex items-center justify-between mt-3">
        <span className="font-plex text-[11px] text-[var(--text-label)] tabular-nums">
          {body.length} / {MAX_BODY_LENGTH}
        </span>
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          data-testid={parentId ? `reply-submit-${parentId}` : 'comment-submit'}
          className="h-10 px-5 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] transition-colors disabled:opacity-60"
          style={{ borderRadius: 'var(--control-radius)' }}
        >
          {submitting ? 'Posting…' : parentId ? 'Post reply' : 'Post comment'}
        </button>
      </div>
      {error && (
        <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mt-3" data-testid="comment-error">
          {error}
        </p>
      )}
    </form>
  );
};

/* Self-hosted comments — no Ghost widget involved. Reuses the same member
   auth already working elsewhere in the app (canAccessPremium/user from
   AuthContext), not Portal's separate and unreliable auth flow. New
   comments and replies are held for approval (status: 'pending') and only
   appear here once approved via /admin/comments. One level of threading:
   replies to a top-level comment, no replies-to-replies. */
export const CustomComments = ({ postSlug, user }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    let active = true;
    if (!postSlug || !API) {
      setLoading(false);
      return;
    }
    fetch(`${API}/api/comments/${postSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setComments(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postSlug]);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = acc[c.parent_id] || [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <div data-testid="custom-comments">
      {!loading && topLevel.length > 0 && (
        <ul className="mb-8">
          {topLevel.map((c) => (
            <li
              key={c.id}
              data-testid={`comment-${c.id}`}
              className="py-4 border-b border-[var(--rule)] first:border-t"
            >
              <p className="font-plex text-[12px] text-[var(--text-label)] mb-2">
                <span className="font-bold text-[var(--text)]">{c.author_name}</span>
                {' · '}
                {relativeDate(c.created_at)}
              </p>
              <p className="font-reading text-[16px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                {c.body}
              </p>

              {(repliesByParent[c.id] || []).map((r) => (
                <div
                  key={r.id}
                  data-testid={`comment-${r.id}`}
                  className="mt-4 pl-4 ml-1 border-l border-[var(--rule)]"
                >
                  <p className="font-plex text-[12px] text-[var(--text-label)] mb-1">
                    <span className="font-bold text-[var(--text)]">{r.author_name}</span>
                    {' · '}
                    {relativeDate(r.created_at)}
                  </p>
                  <p className="font-reading text-[15px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                    {r.body}
                  </p>
                </div>
              ))}

              {user?.email && (
                replyingTo === c.id ? (
                  <div className="mt-4 pl-4 ml-1">
                    <CommentForm
                      postSlug={postSlug}
                      parentId={c.id}
                      user={user}
                      compact
                      onSubmitted={() => {}}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(c.id)}
                    data-testid={`reply-toggle-${c.id}`}
                    className="mt-3 font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] hover:text-[var(--accent-burgundy)] transition-colors"
                  >
                    Reply
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && topLevel.length === 0 && (
        <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] mb-8">
          No comments yet. Be the first to weigh in.
        </p>
      )}

      <CommentForm postSlug={postSlug} user={user} />
    </div>
  );
};

export default CustomComments;
