import { adminAuthHeader, setAdminSessionToken } from './adminSessionToken';

export class AdminAuthError extends Error {
  constructor(status) {
    super('Admin session expired or invalid.');
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

/**
 * The one place every admin dashboard data call goes through. Always
 * attaches the admin bearer token; on a 401/403 it clears the stale token
 * (so the next page load doesn't retry a dead session) and throws
 * AdminAuthError, which every panel's data hook catches to redirect to
 * /admin/login rather than showing a confusing empty table.
 *
 * `path` must be relative (e.g. '/api/admin/subscribers'), same as every
 * other bearer-token call this session moved to -- rides vercel.json's
 * existing /api/:path* proxy, same-origin from the browser's point of
 * view, so it skips the CORS preflight an absolute cross-origin URL would
 * still trigger for a custom Authorization header.
 */
export async function adminFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...adminAuthHeader(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    setAdminSessionToken('');
    throw new AdminAuthError(res.status);
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    /* empty/non-JSON body, e.g. a 204 */
  }

  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${res.status}).`;
    throw new Error(message);
  }

  return data;
}
