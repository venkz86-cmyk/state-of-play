import { useEffect } from 'react';

const GHOST_URL = process.env.REACT_APP_GHOST_URL;
const GHOST_CONTENT_KEY = process.env.REACT_APP_GHOST_CONTENT_API_KEY;

const PORTAL_SCRIPT_ID = 'ghost-portal-script';
const COMMENTS_SCRIPT_ID = 'ghost-comments-script';

/* Ghost's native member-comments widget. Requires two scripts, both
   served from Ghost's own jsDelivr-hosted CDN packages, not from the
   Ghost site's own domain (that used to be the pattern in older Ghost
   versions; current Ghost ships Portal and Comments UI as versioned
   npm/CDN packages instead):

   1. Portal — Ghost's own member-session manager. Loaded quietly here
      (no trigger links point at it anywhere on the site), so it never
      shows its own signup/upgrade UI; it exists purely so Comments has
      a member session to check. A reader who's already logged in via
      the site's own email-only flow is NOT automatically a Portal
      session — Comments will prompt them through Ghost's real
      magic-link sign-in the first time they want to comment. That's a
      one-time thing per browser, not a repeat of the site's own login.
      Portal's own floating "Subscribe" button is turned off from Ghost
      Admin (Settings → Membership → Portal → Look & feel), not from
      code — Portal always ships that button by default otherwise.

   2. Comments UI — the actual embedded thread, scoped to one post via
      its real Ghost id (not the slug used for routing elsewhere).

   Both scripts are safe to leave in the DOM across article navigations
   (Ghost's SDKs de-dupe internally); this only avoids double-injecting
   the <script> tags themselves. */
export const GhostComments = ({ postId }) => {
  useEffect(() => {
    // TEMPORARY diagnostic — remove once Comments is confirmed working.
    console.log('[GhostComments diagnostic]', {
      GHOST_URL,
      GHOST_CONTENT_KEY_present: !!GHOST_CONTENT_KEY,
      postId,
    });
    if (!GHOST_URL || !GHOST_CONTENT_KEY || !postId) return;

    if (!document.getElementById(PORTAL_SCRIPT_ID)) {
      const portal = document.createElement('script');
      portal.id = PORTAL_SCRIPT_ID;
      portal.defer = true;
      portal.src = 'https://cdn.jsdelivr.net/ghost/portal@~2.0/umd/portal.min.js';
      portal.dataset.ghost = GHOST_URL;
      portal.dataset.key = GHOST_CONTENT_KEY;
      portal.dataset.api = `${GHOST_URL}/ghost/api/content/`;
      portal.dataset.i18n = 'false';
      document.body.appendChild(portal);
    }

    if (!document.getElementById(COMMENTS_SCRIPT_ID)) {
      const comments = document.createElement('script');
      comments.id = COMMENTS_SCRIPT_ID;
      comments.async = true;
      comments.crossOrigin = 'anonymous';
      comments.src = 'https://cdn.jsdelivr.net/ghost/comments-ui@~0.5/umd/comments-ui.min.js';
      comments.dataset.commentsId = 'ghost-comments-root';
      comments.dataset.apiUrl = GHOST_URL;
      comments.dataset.apiKey = GHOST_CONTENT_KEY;
      comments.dataset.adminUrl = `${GHOST_URL}/ghost`;
      comments.dataset.colorscheme = 'auto';
      comments.dataset.count = 'false';
      document.body.appendChild(comments);
    }
  }, [postId]);

  if (!GHOST_URL || !GHOST_CONTENT_KEY || !postId) return null;

  return <div id="ghost-comments-root" data-ghost-comments-post-id={postId} />;
};

export default GhostComments;
