import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const API = process.env.REACT_APP_BACKEND_URL;

// Backend member shape (session_auth.py) -> the `user` object every
// consumer in this app reads. `id` is kept as the field name (not
// `ghost_member_id`) because ArticleMockup.js/CustomComments.js already
// expect `user.id` for subscriberGhostId — this is the one place that
// adapts the backend's naming to the app's existing one.
const shapeMember = (data) => ({
  id: data.ghost_member_id || '',
  email: data.email,
  name: data.name,
  is_paid: data.is_paid,
  is_free: data.is_free,
  status: data.status,
  trial_expired: !!data.trial_expired,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: ask the backend who (if anyone) the session cookie belongs
  // to. Replaces the old synchronous localStorage read — there's no local
  // cache of "signed in" any more, the cookie is the only source of truth.
  //
  // This call (and every other session-cookie call in this file) uses a
  // *relative* path, not `${API}/...`. The cookie is set by
  // stateofplay-backend.onrender.com; calling it directly from
  // stateofplay.club makes it a cross-site cookie, which Safari on iOS
  // blocks outright regardless of SameSite/Secure. vercel.json already
  // proxies `/api/:path*` to the backend server-side, so a relative path
  // is same-origin from the browser's point of view -- no cross-site
  // cookie, nothing for Safari's tracking prevention to block.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUser(shapeMember(data));
        } else {
          setUser(null);
        }
      } catch (_e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    // Sticky shared-story attribution: once we land with ?ref=shared-story,
    // remember it for this session so a signup later still credits the nominator.
    try {
      if (new URLSearchParams(window.location.search).get('ref') === 'shared-story') {
        sessionStorage.setItem('tsop_ref_shared', '1');
      }
    } catch (_e) { /* SSR/private-mode guard */ }
  }, []);

  // Step 1 of sign-in: email -> a 6-digit code sent to that inbox, if it
  // matches a real member. Always resolves the same way regardless of
  // whether the email matched anything -- no enumeration signal to read
  // from the response.
  const requestCode = useCallback(async (email) => {
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.detail || 'Could not send a sign-in code. Please try again.' };
      }
      return { success: true };
    } catch (_e) {
      throw new Error('Could not reach the server. Please try again.');
    }
  }, []);

  // Step 2 of sign-in: the typed code -> a real session (httponly cookie
  // set by the backend). This is what used to be verifyMember(email) --
  // now backed by a proven identity instead of a claimed email string.
  const verifyCode = useCallback(async (email, code) => {
    let data;
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.detail || 'Incorrect code. Please try again.' };
      }
    } catch (_e) {
      throw new Error('Could not reach the server. Please try again.');
    }

    const member = shapeMember(data);
    setUser(member);

    // Conversion attribution: if this sign-in follows a shared-story visit,
    // ping the backend so we can credit the nominator. Fire-and-forget.
    try {
      const token = sessionStorage.getItem('tsop_referrer_token');
      const fromShared = new URLSearchParams(window.location.search).get('ref') === 'shared-story';
      if (token && (fromShared || sessionStorage.getItem('tsop_ref_shared') === '1')) {
        const eventType = data.is_paid ? 'signup_paid' : 'signup_free';
        fetch(`${API}/api/cold-link/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_id: token,
            event_type: eventType,
            nominee_email: data.email,
          }),
        }).catch(() => { /* non-fatal */ });
        sessionStorage.removeItem('tsop_referrer_token');
        sessionStorage.removeItem('tsop_ref_shared');
      }
    } catch (_e) { /* non-fatal */ }

    return { success: true, member };
  }, []);

  // Logout - clear the session cookie server-side, then the local state.
  const logout = useCallback(async () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => { /* non-fatal */ });
    setUser(null);
  }, []);

  // Check if user can access premium content
  const canAccessPremium = user?.is_paid || false;
  const isFreeMember = user?.is_free || false;
  const isLoggedIn = !!user;
  const hasExpiredTrial = user?.trial_expired || false;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      requestCode,
      verifyCode,
      logout,
      canAccessPremium,
      isFreeMember,
      isLoggedIn,
      hasExpiredTrial
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
