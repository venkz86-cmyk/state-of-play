import { useEffect } from 'react';

const GHOST_URL = process.env.REACT_APP_GHOST_URL;
const GHOST_CONTENT_KEY = process.env.REACT_APP_GHOST_CONTENT_API_KEY;

const PORTAL_SCRIPT_ID = 'ghost-portal-script';
const COMMENTS_SCRIPT_ID = 'ghost-comments-script';

/* Ghost's native member-comments widget. Requires two scripts:

   1. Portal — Ghost's own member-session manager. Loaded quietly here
      (no trigger links point at it anywhere on the site), so it never
      shows its own signup/upgrade UI; it exists purely so Comments has
      a member session to check. A reader who's already logged in via
      the site's own email-only flow is NOT automatically a Portal
      session — Comments will prompt them through Ghost's real
      magic-link sign-in the first time they want to comment. That's a
      one-time thing per browser, not a repeat of the site's own login.

   2. Comments UI — the actual embedded thread, scoped to one post via
      its real Ghost id (not the slug used for routing elsewhere).

   Both scripts are safe to leave in the DOM across article navigations
   (Ghost's SDKs de-dupe internally); this only avoids double-injecting
   the <script> tags themselves. */
export const GhostComments = ({ postId }) => {
  useEffect(() => {
    if (!GHOST_URL || !GHOST_CONTENT_KEY || !postId) return;

    if (!document.getElementById(PORTAL_SCRIPT_ID)) {
      const portal = document.createElement('script');
      portal.id = PORTAL_SCRIPT_ID;
      portal.defer = true;
      portal.src = `${GHOST_URL}/portal.min.js`;
      portal.dataset.ghost = GHOST_URL;
      portal.dataset.key = GHOST_CONTENT_KEY;
      portal.dataset.i18n = 'false';
      document.body.appendChild(portal);
    }

    if (!document.getElementById(COMMENTS_SCRIPT_ID)) {
      const comments = document.createElement('script');
      comments.id = COMMENTS_SCRIPT_ID;
      comments.async = true;
      comments.crossOrigin = 'anonymous';
      comments.src = `${GHOST_URL}/public/comments-ui.min.js`;
      comments.dataset.commentsId = 'ghost-comments-root';
      comments.dataset.apiUrl = GHOST_URL;
      comments.dataset.apiKey = GHOST_CONTENT_KEY;
      comments.dataset.colorscheme = 'auto';
      comments.dataset.count = 'false';
      document.body.appendChild(comments);
    }
  }, [postId]);

  if (!GHOST_URL || !GHOST_CONTENT_KEY || !postId) return null;

  return <div id="ghost-comments-root" data-ghost-comments-post-id={postId} />;
};

export default GhostComments;
