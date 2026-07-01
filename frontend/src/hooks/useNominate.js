import { useState } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTEXT_MAX = 200;

/**
 * Shared submission + validation logic for the two nominate surfaces:
 *   • NominateReaderBlock (screen — bottom of every article)
 *   • PrintInterceptBlock (print / save-as-PDF intercept)
 *
 * Both post the same payload to /api/nominations/submit. Keeping the state
 * machine here means we can never let their client-side rules drift.
 *
 * Returns:
 *   • form state (name, email, context, submitting, submitted, error)
 *   • setters (setName, setEmail, setContext)
 *   • handleSubmit (e) => Promise<void>
 *   • reset()
 *   • constants (CONTEXT_MAX)
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

  // Guard against pasting a >200-char blob.
  const setContext = (v) => setContextRaw((v || '').slice(0, CONTEXT_MAX));

  const reset = () => {
    setName('');
    setEmail('');
    setContextRaw('');
    setSubmitting(false);
    setSubmitted(false);
    setError('');
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

    setSubmitting(true);
    try {
      await fetch(`${API}/api/nominations/submit`, {
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
    } catch (err) {
      // Fail-open — Apps Script still receives via webhook queue.
      console.debug('nominate fetch error (suppressed):', err);
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  };

  return {
    name,
    email,
    context,
    submitting,
    submitted,
    error,
    setName,
    setEmail,
    setContext,
    handleSubmit,
    reset,
    CONTEXT_MAX,
  };
}
