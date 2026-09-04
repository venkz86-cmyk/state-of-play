import { useState } from 'react';
import { getAdminSessionToken } from '../lib/adminSessionToken';

const API = process.env.REACT_APP_BACKEND_URL;
const ADMIN_EMAIL = 'hello@venkatananth.me';

/**
 * Visible only when the admin email is logged in.
 * - Paywalled story → POST /api/cold-link/generate with admin auth, copy returned URL.
 * - Free story     → copy window.location.href directly.
 *
 * Auth prefers the real admin dashboard session (a bearer token minted by
 * admin_auth.py, same as every dashboard panel uses) -- falls back to the
 * old window.prompt+localStorage X-Admin-Key flow only when no admin
 * session exists on this browser, so this in-article shortcut doesn't
 * force a second sign-in for someone who's already signed into the
 * dashboard elsewhere in the same browser.
 */
export const ColdLinkAdminButton = ({ user, postSlug, isPremium }) => {
  const [status, setStatus] = useState(''); // '', 'copying', 'copied', 'error'
  const [message, setMessage] = useState('');

  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;
  if (!isAdmin) return null;

  const handleClick = async () => {
    setStatus('copying');
    setMessage('');
    try {
      let urlToCopy = window.location.href;
      let confirmation = 'Copied.';

      if (isPremium) {
        const sessionToken = getAdminSessionToken();
        let authHeaders = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : null;

        if (!authHeaders) {
          let adminKey = window.localStorage.getItem('tsop_admin_key') || '';
          if (!adminKey) {
            const k = window.prompt(
              'Paste your TSOP ADMIN_KEY. We\'ll remember it on this device.'
            );
            if (!k) { setStatus(''); return; }
            adminKey = k.trim();
            window.localStorage.setItem('tsop_admin_key', adminKey);
          }
          authHeaders = { 'X-Admin-Key': adminKey };
        }

        const res = await fetch(`${API}/api/cold-link/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ post_slug: postSlug }),
        });
        if (res.status === 403 || res.status === 401) {
          window.localStorage.removeItem('tsop_admin_key');
          throw new Error('Admin auth rejected. Try again.');
        }
        if (!res.ok) {
          throw new Error(`Generation failed (${res.status})`);
        }
        const data = await res.json();
        urlToCopy = data.url;
        confirmation = 'Copied. Link expires in 14 days.';
      }

      await navigator.clipboard.writeText(urlToCopy);
      setStatus('copied');
      setMessage(confirmation);
      setTimeout(() => { setStatus(''); setMessage(''); }, 4000);
    } catch (err) {
      console.error('cold link error:', err);
      setStatus('error');
      setMessage(err.message || 'Could not generate the link.');
      setTimeout(() => { setStatus(''); setMessage(''); }, 5000);
    }
  };

  return (
    <div
      data-testid="cold-link-admin"
      className="mt-3 mb-2 flex items-center gap-3 flex-wrap"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'copying'}
        data-testid="cold-link-admin-button"
        className="font-plex text-[12px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)] hover:underline underline-offset-[5px] decoration-1 disabled:opacity-60"
      >
        {status === 'copying' ? 'Generating…' : 'Generate cold link'}
      </button>
      {message && (
        <span
          className="font-plex text-[12px]"
          style={{ color: status === 'error' ? 'var(--accent-burgundy)' : '#2B5DAC' }}
          data-testid="cold-link-admin-status"
        >
          {message}
        </span>
      )}
    </div>
  );
};

export default ColdLinkAdminButton;
