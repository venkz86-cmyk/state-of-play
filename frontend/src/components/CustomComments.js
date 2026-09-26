import { useEffect, useRef, useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;
const MAX_BODY_LENGTH = 2000;
const MAX_TITLE_LENGTH = 50;
const REPLIES_SHOWN_BY_DEFAULT = 2;
const TITLE_STORAGE_KEY = 'tsop_comment_author_title';

const relativeDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL_RE = /(https?:\/\/[^\s<]+)/g;
// Trailing punctuation a URL picked up from the surrounding sentence, not
// part of the link itself — "check this out: stateofplay.club/x." shouldn't
// swallow the period.
const TRAILING_PUNCT_RE = /[),.!?;:'"]+$/;

const linkClass = 'text-[var(--accent-burgundy)] underline underline-offset-[3px] decoration-1 hover:decoration-2 break-all';

/* Turns a comment body into text + <a> nodes — markdown [text](url) links
   first, then any bare http(s) URL left in the remaining plain-text
   segments. No HTML is ever parsed out of user input; every non-link
   segment stays plain text, so this can't reintroduce XSS the way
   dangerouslySetInnerHTML would. */
const LinkifiedText = ({ text }) => {
  if (!text) return null;
  const nodes = [];
  let key = 0;

  const pushPlainSegment = (segment) => {
    let lastIndex = 0;
    let match;
    BARE_URL_RE.lastIndex = 0;
    while ((match = BARE_URL_RE.exec(segment))) {
      const start = match.index;
      if (start > lastIndex) nodes.push(segment.slice(lastIndex, start));
      let url = match[0];
      let trailing = '';
      const trailMatch = url.match(TRAILING_PUNCT_RE);
      if (trailMatch) {
        trailing = trailMatch[0];
        url = url.slice(0, url.length - trailing.length);
      }
      if (url) {
        nodes.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className={linkClass}>
            {url}
          </a>
        );
      }
      if (trailing) nodes.push(trailing);
      lastIndex = start + match[0].length;
    }
    if (lastIndex < segment.length) nodes.push(segment.slice(lastIndex));
  };

  let lastIndex = 0;
  let match;
  MARKDOWN_LINK_RE.lastIndex = 0;
  while ((match = MARKDOWN_LINK_RE.exec(text))) {
    const [full, label, url] = match;
    const start = match.index;
    if (start > lastIndex) pushPlainSegment(text.slice(lastIndex, start));
    nodes.push(
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className={linkClass}>
        {label}
      </a>
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) pushPlainSegment(text.slice(lastIndex));

  return <>{nodes}</>;
};

// A bare domain typed without a scheme ("stateofplay.club/x") still needs
// one to be a real link the browser will navigate — added here rather than
// left to the reader to get right.
const normalizeLinkUrl = (raw) => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
};

// Writes `[selected text](url)` (or just the bare url, with nothing
// selected) into the textarea at the given range, then restores focus and
// caret. Shared by the prompt-driven insert below and the paste-to-linkify
// handler, so both end up with identical, predictable output.
const applyLinkAtRange = (textareaEl, value, setValue, maxLength, start, end, normalizedUrl) => {
  const selected = value.slice(start, end);
  const insertion = selected ? `[${selected}](${normalizedUrl})` : normalizedUrl;
  const nextValue = (value.slice(0, start) + insertion + value.slice(end)).slice(0, maxLength);
  setValue(nextValue);

  requestAnimationFrame(() => {
    if (!textareaEl) return;
    textareaEl.focus();
    const caret = Math.min(start + insertion.length, maxLength);
    textareaEl.setSelectionRange(caret, caret);
  });
};

/* Shared by both the new-comment/reply box and the edit box: wraps the
   current text selection as a markdown link (or, with nothing selected,
   just drops the URL in — it auto-linkifies as a bare URL on render, same
   as pasting one). Triggered by Ctrl/Cmd+K for anyone typing on a keyboard,
   and by a plain tap-target button for anyone without one — a shortcut
   alone would leave mobile with no way to add a link at all. window.prompt
   is deliberately the whole "dialog": it's a one-field, cancel-or-submit
   ask, and every mobile and desktop browser already renders it natively. */
const insertLinkAtSelection = (textareaEl, value, setValue, maxLength) => {
  const url = window.prompt('Link URL');
  if (url === null) return;
  const normalized = normalizeLinkUrl(url);
  if (!normalized) return;

  const start = textareaEl ? textareaEl.selectionStart : value.length;
  const end = textareaEl ? textareaEl.selectionEnd : value.length;
  applyLinkAtRange(textareaEl, value, setValue, maxLength, start, end, normalized);
};

const handleLinkShortcut = (e, insert) => {
  const isMod = e.metaKey || e.ctrlKey;
  if (isMod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    insert();
  }
};

// The whole clipboard payload has to BE a URL, not just contain one --
// pasting a paragraph that happens to mention a link over a selection
// should still paste as plain text, same as anywhere else.
const PASTED_URL_RE = /^(https?:\/\/\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?)$/i;

/* Paste-to-linkify, Notion/Docs-style: pasting a URL while text is
   selected wraps that selection into a link with the pasted URL, instead
   of replacing it with the raw URL text. Only kicks in when there's an
   actual selection and the clipboard is nothing but a URL -- any other
   paste (nothing selected, or pasted text that isn't just a link) falls
   through to the browser's normal paste untouched. */
const handleLinkPaste = (e, value, setValue, maxLength) => {
  const textareaEl = e.target;
  const start = textareaEl.selectionStart;
  const end = textareaEl.selectionEnd;
  if (start === end) return;

  const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
  if (!PASTED_URL_RE.test(pasted)) return;

  const normalized = normalizeLinkUrl(pasted);
  if (!normalized) return;

  e.preventDefault();
  applyLinkAtRange(textareaEl, value, setValue, maxLength, start, end, normalized);
};

const LinkButton = ({ onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    title="Add link (Ctrl+K)"
    aria-label="Add link"
    className="py-1.5 pr-2 font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] hover:text-[var(--accent-burgundy)] transition-colors"
  >
    Link
  </button>
);

/* Edit UI for a commenter's own, already-live comment. Applies immediately
   on save — no moderation queue, unlike a brand-new comment (the comment
   was already reviewed once to get published; editing it is the author's
   own call from there). onSaved lifts the new body/edited_at back into the
   parent's comment list and closes the form. */
const EditCommentForm = ({ comment, user, onSaved, onCancel }) => {
  const [body, setBody] = useState(comment.body);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  const unchanged = body.trim() === (comment.body || '').trim();
  const insertLink = () => insertLinkAtSelection(textareaRef.current, body, setBody, MAX_BODY_LENGTH);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() || unchanged) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/comments/${comment.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_email: user.email, body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not save your edit.');
      }
      onSaved(data.body, data.edited_at);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <textarea
        ref={textareaRef}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
        onKeyDown={(e) => handleLinkShortcut(e, insertLink)}
        onPaste={(e) => handleLinkPaste(e, body, setBody, MAX_BODY_LENGTH)}
        disabled={submitting}
        data-testid={`edit-body-input-${comment.id}`}
        className="w-full px-4 py-3 bg-transparent border border-[var(--rule)] font-reading text-[15px] focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
        style={{ borderRadius: 'var(--control-radius)', outline: 'none' }}
      />
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <LinkButton onClick={insertLink} testId={`edit-link-${comment.id}`} />
          <span className="font-plex text-[11px] text-[var(--text-label)] tabular-nums">
            {body.length} / {MAX_BODY_LENGTH}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] hover:text-[var(--text)] transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !body.trim() || unchanged}
            data-testid={`edit-submit-${comment.id}`}
            className="h-9 px-4 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[12px] uppercase tracking-[0.05em] transition-colors disabled:opacity-60"
            style={{ borderRadius: 'var(--control-radius)' }}
          >
            {submitting ? 'Saving…' : 'Save edit'}
          </button>
        </div>
      </div>
      {error && (
        <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mt-3" data-testid={`edit-error-${comment.id}`}>
          {error}
        </p>
      )}
    </form>
  );
};

/* Shared submit form — used for both a new top-level comment and an inline
   reply. Reply mode is just parentId being set; everything else (server
   call, pending-approval confirmation) is identical. */
const CommentForm = ({ postSlug, parentId, user, compact, onSubmitted }) => {
  const [body, setBody] = useState('');
  const [title, setTitle] = useState(() => {
    try {
      return window.localStorage.getItem(TITLE_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const insertLink = () => insertLinkAtSelection(textareaRef.current, body, setBody, MAX_BODY_LENGTH);

  // Pull the server-side value (from their most recent comment) so the
  // title follows them across devices, not just this browser. localStorage
  // above is just the instant-paint fallback while this is in flight; only
  // the visible top-level form needs to fetch it — reply forms stay on
  // whatever's already cached locally.
  useEffect(() => {
    if (compact || !user?.email || !API) return;
    let active = true;
    fetch(`${API}/api/comments/my-title?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.title) {
          setTitle(data.title);
          try {
            window.localStorage.setItem(TITLE_STORAGE_KEY, data.title);
          } catch (e) { /* ignore */ }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, user?.email]);

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
          author_title: title.trim(),
          body: body.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not submit your comment.');
      }
      setBody('');
      setSubmitted(true);
      try {
        window.localStorage.setItem(TITLE_STORAGE_KEY, title.trim());
      } catch (e) { /* ignore */ }
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
      {!compact && (
        <div className="mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
            data-testid="comment-title-input"
            disabled={submitting}
            placeholder="Title or affiliation, optional. Portfolio Manager, XYZ Capital"
            className="w-full px-4 py-2.5 bg-transparent border border-[var(--rule)] font-reading text-[14px] focus:border-[var(--accent-burgundy)] disabled:opacity-60"
            style={{ borderRadius: 'var(--control-radius)', outline: 'none' }}
          />
        </div>
      )}
      <textarea
        ref={textareaRef}
        rows={compact ? 2 : 3}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
        onKeyDown={(e) => handleLinkShortcut(e, insertLink)}
        onPaste={(e) => handleLinkPaste(e, body, setBody, MAX_BODY_LENGTH)}
        data-testid={parentId ? `reply-body-input-${parentId}` : 'comment-body-input'}
        disabled={submitting}
        placeholder={parentId ? 'Write a reply…' : 'Add to the conversation…'}
        className="w-full px-4 py-3 bg-transparent border border-[var(--rule)] font-reading text-[15px] focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
        style={{ borderRadius: 'var(--control-radius)', outline: 'none' }}
      />
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <LinkButton onClick={insertLink} testId={parentId ? `reply-link-${parentId}` : 'comment-link'} />
          <span className="font-plex text-[11px] text-[var(--text-label)] tabular-nums">
            {body.length} / {MAX_BODY_LENGTH}
          </span>
        </div>
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
  const [editingId, setEditingId] = useState(null);
  const [expandedThreads, setExpandedThreads] = useState({});

  // Ownership is decided server-side now (is_own) — the public feed never
  // sends back anyone's raw email, so there's nothing to compare here.
  const isOwnComment = (c) => !!c.is_own;

  const applyEditLocally = (commentId, newBody, editedAt) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: newBody, edited_at: editedAt } : c)));
    setEditingId(null);
  };

  useEffect(() => {
    let active = true;
    if (!postSlug || !API) {
      setLoading(false);
      return;
    }
    const qs = user?.email ? `?viewer_email=${encodeURIComponent(user.email)}` : '';
    fetch(`${API}/api/comments/${postSlug}${qs}`)
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
  }, [postSlug, user?.email]);

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
          {topLevel.map((c) => {
            const replies = repliesByParent[c.id] || [];
            const expanded = !!expandedThreads[c.id];
            const visibleReplies = expanded ? replies : replies.slice(0, REPLIES_SHOWN_BY_DEFAULT);
            const hiddenCount = replies.length - visibleReplies.length;

            return (
              <li
                key={c.id}
                data-testid={`comment-${c.id}`}
                className="py-4 border-b border-[var(--rule)] first:border-t"
              >
                <p className="font-plex text-[12px] text-[var(--text-label)] mb-2">
                  <span className="font-bold text-[var(--text)]">{c.author_name}</span>
                  {c.author_title && <span>, {c.author_title}</span>}
                  {' · '}
                  {relativeDate(c.created_at)}
                  {c.edited_at && <span> · edited</span>}
                </p>
                {editingId === c.id ? (
                  <EditCommentForm
                    comment={c}
                    user={user}
                    onCancel={() => setEditingId(null)}
                    onSaved={(newBody, editedAt) => applyEditLocally(c.id, newBody, editedAt)}
                  />
                ) : (
                  <p className="font-reading text-[16px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                    <LinkifiedText text={c.body} />
                  </p>
                )}

                {visibleReplies.length > 0 && (
                  <div className="mt-4 pl-4 ml-1 border-l border-[var(--rule)] space-y-4">
                    {visibleReplies.map((r) => (
                      <div key={r.id} data-testid={`comment-${r.id}`}>
                        <p className="font-plex text-[12px] text-[var(--text-label)] mb-1">
                          <span className="font-bold text-[var(--text)]">{r.author_name}</span>
                          {r.author_title && <span>, {r.author_title}</span>}
                          {' · '}
                          {relativeDate(r.created_at)}
                          {r.edited_at && <span> · edited</span>}
                        </p>
                        {editingId === r.id ? (
                          <EditCommentForm
                            comment={r}
                            user={user}
                            onCancel={() => setEditingId(null)}
                            onSaved={(newBody, editedAt) => applyEditLocally(r.id, newBody, editedAt)}
                          />
                        ) : (
                          <>
                            <p className="font-reading text-[15px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                              <LinkifiedText text={r.body} />
                            </p>
                            {isOwnComment(r) && (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                data-testid={`edit-toggle-${r.id}`}
                                className="mt-2 font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] hover:text-[var(--accent-burgundy)] transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: true }))}
                    data-testid={`expand-replies-${c.id}`}
                    className="mt-3 ml-5 font-plex text-[12px] text-[var(--accent-burgundy)] underline underline-offset-[4px] decoration-1 hover:decoration-2"
                  >
                    Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
                {expanded && replies.length > REPLIES_SHOWN_BY_DEFAULT && (
                  <button
                    type="button"
                    onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: false }))}
                    data-testid={`collapse-replies-${c.id}`}
                    className="mt-3 ml-5 font-plex text-[12px] text-[var(--text-label)] underline underline-offset-[4px] decoration-1 hover:decoration-2"
                  >
                    Hide replies
                  </button>
                )}

                {user?.email && editingId !== c.id && (
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
                    <div className="mt-3 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setReplyingTo(c.id)}
                        data-testid={`reply-toggle-${c.id}`}
                        className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] hover:text-[var(--accent-burgundy)] transition-colors"
                      >
                        Reply
                      </button>
                      {isOwnComment(c) && (
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          data-testid={`edit-toggle-${c.id}`}
                          className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] hover:text-[var(--accent-burgundy)] transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )
                )}
              </li>
            );
          })}
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
