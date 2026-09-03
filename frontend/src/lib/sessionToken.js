// The session's actual source of truth, since Sept 2026 -- not a cookie.
//
// A cookie set by stateofplay-backend.onrender.com and read on
// stateofplay.club, even routed through vercel.json's same-origin proxy,
// still depends on every hop along the way -- the browser's own
// third-party-cookie policy, SameSite handling, and whether the proxying
// layer forwards Set-Cookie faithfully -- getting it right. A reader on
// iPhone Safari hit that; a reader on desktop Chrome then hit a session
// that silently didn't survive a refresh, for reasons that never fully
// pinned down to one of those hops. A bearer token sent explicitly in
// every request's Authorization header depends on none of that -- it's
// just a string this code reads and sends, identical in every browser.
//
// localStorage's real trade-off (JS-readable, unlike an httponly cookie)
// is a smaller risk here than a session that silently doesn't work.
const KEY = 'tsop_session_token';

export function getSessionToken() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch (_e) {
    return ''; // private-mode/storage-blocked -- fail to "not signed in"
  }
}

export function setSessionToken(token) {
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

// Spread into a fetch's `headers` object. Empty object (adds nothing) when
// there's no token, so callers can always spread it unconditionally.
export function authHeader() {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
