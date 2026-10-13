import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

/* The header menu in the home-screen app. The website's menu repeats the
   site's navigation, which the tab bar already covers in the app, so this
   one holds what the tabs don't: the rest of The State of Play, the app's
   settings (notifications, dark mode) and signing in or out. It opens over
   the page, below the header, with the tab bar still in reach. */
const label = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const Row = ({ to, title, desc, onGo }) => (
  <li className="border-b border-[var(--rule)]">
    <Link to={to} onClick={onGo} className="group flex items-center justify-between gap-4 py-4">
      <span>
        <span className="block font-plex text-[16px] font-medium">{title}</span>
        <span className="block font-plex text-[13px] text-[var(--text-muted)] mt-0.5">{desc}</span>
      </span>
      <span className="font-plex text-[18px] text-[var(--text-label)]" aria-hidden="true">›</span>
    </Link>
  </li>
);

export const AppMenu = ({ open, onClose, anchorRef }) => {
  const { user, isLoggedIn, canAccessPremium, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [top, setTop] = useState(64);
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    if (anchorRef?.current) setTop(anchorRef.current.getBoundingClientRect().bottom);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open, anchorRef]);

  if (!open) return null;
  return (
    <div
      id="mobile-nav"
      ref={panel}
      tabIndex={-1}
      data-testid="app-menu"
      className="app-menu fixed inset-x-0 bottom-0 overflow-y-auto bg-[var(--bg)] outline-none"
      style={{ top }}
    >
      <div className="max-w-[720px] mx-auto px-6 pt-6 pb-32">
        <section>
          <div className="border-b border-[var(--text)] pb-3"><p className={label}>The State of Play</p></div>
          <ul>
            <Row to="/outfield" title="The Outfield" desc="Our events: small rooms, off the record" onGo={onClose} />
            {!canAccessPremium && <Row to="/trial" title="The Ten" desc="Ten recent stories for ₹590" onGo={onClose} />}
            <Row to="/teams" title="For Teams" desc="Membership for your whole team" onGo={onClose} />
          </ul>
        </section>

        <section className="mt-10">
          <div className="border-b border-[var(--text)] pb-3"><p className={label}>Settings</p></div>
          <ul>
            <Row to="/app" title="Notifications" desc="Choose what you get" onGo={onClose} />
            <li className="border-b border-[var(--rule)]">
              <label className="flex items-center justify-between gap-6 py-4 cursor-pointer">
                <span className="block font-plex text-[16px] font-medium">Dark mode</span>
                <input type="checkbox" role="switch" className="sr-only peer" checked={isDark} onChange={toggleTheme} data-testid="app-menu-dark" />
                <span aria-hidden="true"
                  className="relative shrink-0 h-7 w-12 rounded-full bg-[var(--rule)] peer-checked:bg-[var(--accent-blue)] transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:h-[22px] after:w-[22px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--accent-ink)]" />
              </label>
            </li>
          </ul>
        </section>

        <section className="mt-10" data-testid="app-menu-account">
          {isLoggedIn ? (
            <div className="flex items-center justify-between gap-4">
              <p className="font-plex text-[13px] text-[var(--text-muted)] min-w-0 truncate">Signed in as {user?.email}</p>
              <button type="button" onClick={() => { logout(); onClose(); }} data-testid="app-menu-signout"
                className="shrink-0 font-plex text-[14px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <Link to="/login" onClick={onClose} data-testid="app-menu-signin"
                className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-8 transition-colors">
                Sign in
              </Link>
              <Link to="/signup" onClick={onClose} className="font-plex text-[15px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
                Become a member
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AppMenu;
