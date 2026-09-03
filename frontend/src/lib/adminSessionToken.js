// Venkat's own admin session token -- deliberately a SEPARATE localStorage
// key from lib/sessionToken.js's reader token. Never shared, never
// interchangeable: admin_auth.py mints this with its own secret and a
// distinct JWT audience, so even if both ended up in the same browser,
// neither can be used as the other.
const KEY = 'tsop_admin_session_token';

export function getAdminSessionToken() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function setAdminSessionToken(token) {
  try {
    if (token) {
      localStorage.setItem(KEY, token);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch (_e) {
    /* private-mode/storage-blocked -- sign-in just won't persist */
  }
}

export function adminAuthHeader() {
  const token = getAdminSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
