import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { authHeader } from '../lib/sessionToken';
import { track } from '../lib/analytics';

/* "Read this in the app", on a story page in a phone's browser (a link from
   an email lands there, and on iPhone a link can't open a home-screen app).
   Tapping it leaves the story with the server (backend handoff.py); opening
   State of Play from the home screen within two minutes takes the reader
   straight to it (claimHandoff, called by the app). Shown to every phone
   reader, since the browser can't tell whether the app is installed; the
   sheet says how to get it for anyone who hasn't. */
const API = process.env.REACT_APP_BACKEND_URL;
const label = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const isPhone = () =>
  typeof window !== 'undefined' && !!window.matchMedia
  && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 768;

export const AppHandoff = ({ path }) => {
  const [show] = useState(isPhone);
  const [open, setOpen] = useState(false);
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!show || !path) return null;

  const offer = () => {
    setOpen(true);
    track('app_handoff_offer', { path });
    fetch(`${API}/api/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  };

  return (
    <>
      <button type="button" onClick={offer} data-testid="app-handoff"
        className="-mt-3 mb-6 font-plex text-[14px] text-[var(--text-muted)] underline underline-offset-4 decoration-[var(--rule)] hover:text-[var(--text)]">
        Read this in the app ›
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[60]" data-testid="app-handoff-sheet">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 cursor-default" />
          <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Read in the app"
            className="absolute inset-x-0 bottom-0 bg-[var(--bg)] text-[var(--text)] border-t border-[var(--rule)] outline-none">
            <div className="max-w-[560px] mx-auto px-6 pt-5 pb-8">
              <div className="flex items-center justify-between border-b border-[var(--text)] pb-3">
                <p className={label}>Read in the app</p>
                <button type="button" onClick={() => setOpen(false)} className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)]">Done</button>
              </div>
              <p className="font-editorial text-[24px] leading-[1.2] mt-5">
                Open State of Play from your home screen within two minutes. It opens on this story.
              </p>
              <p className="font-plex text-[14px] text-[var(--text-muted)] mt-5">
                Don’t have it yet?{' '}
                <Link to="/app" onClick={() => setOpen(false)} data-testid="app-handoff-get"
                  className="text-[var(--text)] underline underline-offset-4 decoration-[var(--rule)]">
                  Add it to your phone
                </Link>
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

// In the app: the story this phone handed over in the last two minutes, if
// any (backend handoff.py gives it out once).
export async function claimHandoff() {
  try {
    const r = await fetch(`${API}/api/handoff`, { headers: authHeader() });
    if (!r.ok) return null;
    const { path } = await r.json();
    return typeof path === 'string' && /^\/(?:left-field\/e\/)?[a-z0-9][a-z0-9-]*$/.test(path) ? path : null;
  } catch (e) {
    return null;
  }
}

export default AppHandoff;
