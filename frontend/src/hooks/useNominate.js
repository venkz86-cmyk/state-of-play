import { useEffect, useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTEXT_MAX = 200;

/**
 * Shared submission + validation logic for the two nominate surfaces:
 *   • NominateReaderBlock (screen — bottom of every article)
 *   • PrintInterceptBlock (print / save-as-PDF intercept)
 *
 * Both post the same payload to POST /api/nominations/submit. Keeping the
 * state machine here means we can never let their client-side rules drift.
 *
 * Session-8 additions:
 *   • On mount, fetches GET /api/nominations/quota?subscriber_email=… to
 *     surface how many nominations remain this calendar month.
 *   • Handles two new server-side error shapes:
 *       { success: false, error: 'quota_exceeded', … }
 *       { success: false, error: 'duplicate_nominee', … }
 *     These set `blocked` to a discriminator string ('quota' | 'duplicate')
 *     so the UI can hide the form and show the right message.
 */
export function useNominate({
  subscriberEmail,
  subscriberName,
  subscriberGhostId,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [context, setContextRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // Abuse-prevention state
  const [quota, setQuota] = useState(null);           // { used, quota, remaining, resets_on } | null
  const [blocked, setBlocked] = useState('');         // '' | 'quota' | 'duplicate'
  const [resetsOn, setResetsOn] = useState('');       // eg '1 August'

  // Fetch remaining quota on mount (and whenever subscriber changes).
  useEffect(() => {
    if (!subscriberEmail || !API) return;
    let alive = true;
    fetch(
      `${API}/api/nominations/quota?subscriber_email=${encodeURIComponent(subscriberEmail)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setQuota(data);
        setResetsOn(data.resets_on || '');
        if (data.remaining === 0) setBlocked('quota');
      })
      .catch(() => {
        /* fail-open — the widget still works, just without a counter */
      });
    return () => {
      alive = false;
    };
  }, [subscriberEmail]);

  // Guard against pasting a >200-char blob.
  const setContext = (v) => setContextRaw((v || '').slice(0, CONTEXT_MAX));

  const reset = () => {
    setName('');
    setEmail('');
    setContextRaw('');
    setSubmitting(false);
    setSubmitted(false);
    setError('');
    // NB: intentionally don't clear `blocked` — a subscriber who has hit
    // their quota shouldn't be able to reset back to a form view.
  };

  // Allow the UI to clear a `duplicate` block so the subscriber can nominate
  // someone else. Quota blocks are sticky — no clearing.
  const clearBlock = () => {
    if (blocked === 'duplicate') {
      setBlocked('');
      setName('');
      setEmail('');
      setContextRaw('');
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    const nName = name.trim();
    const nEmail = email.trim().toLowerCase();
    const nCtx = context.trim();

    if (!nName) return setError('Please enter the nominee’s name.');
    if (!EMAIL_RE.test(nEmail))
      return setError('Please enter a valid email address.');
    if (!nCtx) return setError('A line of context helps us reach out well.');
    if (nEmail === (subscriberEmail || '').toLowerCase()) {
      return setError('You’re already a reader. Try nominating someone else.');
    }

    // Guard: without a configured backend URL the fetch would silently
    // resolve to a relative path (e.g. /account/api/nominations/submit)
    // and 404 on Vercel — the exact "no server log, quota untouched"
    // symptom we've seen in production.
    if (!API) {
      console.error('nominate: REACT_APP_BACKEND_URL is not set at build time');
      setError('Could not reach the server. Please refresh and try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/nominations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_ghost_id: subscriberGhostId || '',
          subscriber_name: subscriberName || '',
          subscriber_email: subscriberEmail || '',
          nominee_name: nName,
          nominee_email: nEmail,
          nominee_context: nCtx,
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        /* non-JSON response */
      }
      if (!res.ok) {
        // 4xx / 5xx from server (e.g. validation on empty subscriber_email).
        setError('Something went wrong. Try again in a moment.');
        setSubmitting(false);
        return;
      }
      if (data && data.success === false) {
        // Abuse-prevention rejects
        if (data.error === 'quota_exceeded') {
          setBlocked('quota');
          setResetsOn(data.resets_on || resetsOn);
          setQuota({
            used: data.quota || 5,
            quota: data.quota || 5,
            remaining: 0,
            resets_on: data.resets_on || resetsOn,
          });
          setSubmitting(false);
          return;
        }
        if (data.error === 'duplicate_nominee') {
          setBlocked('duplicate');
          setSubmitting(false);
          return;
        }
        // Unknown server-side rejection — surface generically.
        setError('Something went wrong. Try again in a moment.');
        setSubmitting(false);
        return;
      }
      // Success — refresh remaining count if the server told us.
      if (data && typeof data.nominations_remaining === 'number') {
        setQuota((prev) =>
          prev
            ? { ...prev, remaining: data.nominations_remaining, used: prev.quota - data.nominations_remaining }
            : { used: 5 - data.nominations_remaining, quota: 5, remaining: data.nominations_remaining, resets_on: resetsOn },
        );
      }
      setSubmitted(true);
      setSubmitting(false);
    } catch (err) {
      // Network-level throw (CORS preflight, offline, aborted during print
      // preview, DNS blip, mixed content). Previously we treated this as
      // fail-open success — that lied to the user and the backend never
      // received the nomination. Surface it instead so the subscriber can
      // retry and we don't lose intent.
      console.error('nominate submit fetch failed:', err);
      setError('Could not reach the server. Please check your connection and try again.');
      setSubmitting(false);
    }
  };

  return {
    // form state
    name,
    email,
    context,
    submitting,
    submitted,
    error,
    // setters
    setName,
    setEmail,
    setContext,
    // actions
    handleSubmit,
    reset,
    clearBlock,
    // quota / blocks
    quota,
    blocked,
    resetsOn,
    CONTEXT_MAX,
  };
}
