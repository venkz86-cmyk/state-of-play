import { useEffect, useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;
const MAX_BODY_LENGTH = 2000;

const relativeDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* Self-hosted comments — no Ghost widget involved. Reuses the same member
   auth already working elsewhere in the app (canAccessPremium/user from
   AuthContext), not Portal's separate and unreliable auth flow. New
   comments are held for approval (state: 'pending') and only appear here
   once approved via /admin/comments. */
export const CustomComments = ({ postSlug, user }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="custom-comments">
      {!loading && comments.length > 0 && (
        <ul className="mb-8">
          {comments.map((c) => (
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
              <p className="font-plex text-[15px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!loading && comments.length === 0 && (
        <p className="font-plex text-[14px] text-[var(--text-label)] mb-8">
          No comments yet. Be the first to weigh in.
        </p>
      )}

      {submitted ? (
        <p className="font-plex text-[14px] text-[var(--text-muted)]" data-testid="comment-submitted">
          Submitted — it'll show up here once it's been reviewed.{' '}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
          >
            Add another
          </button>
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
            data-testid="comment-body-input"
            disabled={submitting}
            placeholder="Add to the conversation…"
            className="w-full px-4 py-3 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
            style={{ borderRadius: 'var(--control-radius)' }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="font-plex text-[11px] text-[var(--text-label)] tabular-nums">
              {body.length} / {MAX_BODY_LENGTH}
            </span>
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              data-testid="comment-submit"
              className="h-11 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] transition-colors disabled:opacity-60"
              style={{ borderRadius: 'var(--control-radius)' }}
            >
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
          {error && (
            <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mt-3" data-testid="comment-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default CustomComments;
