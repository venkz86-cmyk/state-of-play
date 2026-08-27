import { useEffect } from 'react';
import { Search } from 'lucide-react';

const GHOST_CONTENT_KEY = process.env.REACT_APP_GHOST_CONTENT_API_KEY;
const SITE_URL = 'https://www.stateofplay.club';

const SCRIPT_ID = 'ghost-sodo-search-script';

/* Ghost's native search widget (sodo-search). Public, no member/session
   dependency — unlike Comments/Portal, this is just a search-in-a-modal
   over published post metadata via the Content API, so none of the
   auth-bridging complexity applies here.

   Ghost normally injects this script itself via {ghost_head} for themed
   sites; this site is headless, so the equivalent tag is hand-built here,
   verified against a real Ghost-generated example rather than guessed:
     <script defer src=".../sodo-search.min.js" data-key="..."
       data-styles=".../main.css" data-sodo-search="{site url}"
       data-locale="en" crossorigin="anonymous"></script>
   The trigger is any element with a bare `data-ghost-search` attribute —
   no custom JS wiring needed once the script has loaded. */
export const useGhostSearchScript = () => {
  useEffect(() => {
    if (!GHOST_CONTENT_KEY || document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://cdn.jsdelivr.net/ghost/sodo-search@~1.5/umd/sodo-search.min.js';
    script.dataset.key = GHOST_CONTENT_KEY;
    script.dataset.styles = 'https://cdn.jsdelivr.net/ghost/sodo-search@~1.5/umd/main.css';
    script.dataset.sodoSearch = SITE_URL;
    script.dataset.locale = 'en';
    document.body.appendChild(script);
  }, []);
};

export const GhostSearchTrigger = ({ className = '' }) => (
  <button
    type="button"
    data-ghost-search
    data-testid="mockup-header-search"
    aria-label="Search"
    className={`h-9 w-9 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-200 ${className}`}
  >
    <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
  </button>
);
