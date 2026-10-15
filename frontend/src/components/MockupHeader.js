import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X, Sun, Moon, ChevronLeft } from 'lucide-react';
import { SiteSearchTrigger } from './SiteSearch';
import { IS_APP_MODE, TAB_ROOTS } from '../lib/appMode';
import { AppMenu } from './AppMenu';

// Single asset. The logo is a flat single-color PNG (brand blue on
// transparent), so a plain CSS `invert` produced a muddy khaki tone
// (255-34, 255-74, 255-159 -> a dull gold), not white. brightness-0 first
// crushes it to solid black, then invert flips that to solid white — a
// clean silhouette for dark mode with no second asset needed. Do NOT
// re-introduce a LOGO_DARK constant pointing at the same file — that
// misled a previous audit into thinking a real dark-mode swap existed.
const LOGO_SRC = '/tsop-logo.png';

const NAV = [
  { path: '/', label: 'Home' },
  { path: '/state-of-play', label: 'Stories' },
  { path: '/left-field', label: 'The Left Field' },
  { path: '/outfield', label: 'The Outfield' },
  { path: '/trial', label: 'The Ten' },
  { path: '/teams', label: 'For Teams' },
];

export const MockupHeader = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef(null);

  const previewMember = searchParams.get('preview') === 'member';
  // Whether to show "My Account/Sign out" vs "Sign in/Subscribe" -- any
  // signed-in reader, not just a paying one. This used to key off
  // canAccessPremium, which is deliberately false for a Trial ("The Ten")
  // member (tiers.py's PAID_LABELS), so a logged-in trial reader saw
  // "Sign in" and "Subscribe" in their own nav the entire time they were
  // reading their own unlocked stories -- confusing, and wrong regardless
  // of tier, since it's asking someone to do something they've already done.
  const showAccountNav = isLoggedIn || previewMember;
  const memberName =
    (user && (user.name || user.email?.split('@')[0])) ||
    (previewMember ? 'Venkatesh' : null);

  const isActive = (p) => location.pathname === p;
  // Home-screen app: no browser back button, so every page that isn't a
  // tab gets one here (back through the app's own history, else home).
  const navigate = useNavigate();
  const showBack = IS_APP_MODE && !TAB_ROOTS.includes(location.pathname);
  const goBack = () => (window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/'));

  // The phone menu closes on a new page and on Escape.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Skip link: jumps past the header to the page's main area.
  const skipToContent = (e) => {
    const target = document.getElementById('main-content');
    if (!target) return;
    e.preventDefault();
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView();
  };

  return (
    <header
      ref={headerRef}
      data-testid="mockup-header"
      className="theme-transition sticky top-0 z-50 bg-[var(--nav-bg)] border-b border-[var(--rule)]"
    >
      <a href="#main-content" className="skip-link font-plex text-[14px]" onClick={skipToContent}>Skip to content</a>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-6">
          {/* Logo, with a back arrow before it in the home-screen app */}
          <div className="flex items-center gap-1 shrink-0">
          {showBack && (
            <button type="button" onClick={goBack} aria-label="Back" data-testid="app-back"
              className="h-11 w-9 -ml-2.5 inline-flex items-center justify-center text-[var(--text)]">
              <ChevronLeft className="h-6 w-6" strokeWidth={1.6} />
            </button>
          )}
          <Link
            to="/"
            data-testid="mockup-header-logo"
            className="flex items-center group shrink-0"
          >
            <img
              src={LOGO_SRC}
              alt="The State of Play"
              className={`h-10 lg:h-12 w-auto transition-opacity duration-200 group-hover:opacity-80 ${isDark ? 'brightness-0 invert' : ''}`}
            />
          </Link>
          </div>

          {/* Desktop nav — Schibsted Grotesk 15px */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-8 flex-1 justify-center">
            {NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`mockup-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`font-plex text-[15px] whitespace-nowrap transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-[var(--accent-ink)]'
                    : 'text-[var(--text)] hover:text-[var(--text-muted)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right rail */}
          <div className="flex items-center gap-4 lg:gap-5 shrink-0">
            {/* In the app the Search tab does this. */}
            <span className="app-hide"><SiteSearchTrigger /></span>

            {/* Dark mode toggle (in the app, it's in the menu) */}
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="mockup-header-theme-toggle"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="app-hide h-11 w-11 -mx-1 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-200"
            >
              {isDark
                ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} />
                : <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            </button>

            {showAccountNav ? (
              <div className="hidden sm:flex items-center gap-5">
                <Link
                  to="/account"
                  data-testid="mockup-header-account"
                  className="font-plex text-[15px] text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-200"
                >
                  {memberName ? memberName.split(' ')[0] : 'My Account'}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  data-testid="mockup-header-logout"
                  className="font-plex text-[15px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-6">
                <Link
                  to="/login"
                  data-testid="mockup-header-login"
                  className="font-plex text-[15px] text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  data-testid="mockup-header-subscribe"
                  className="inline-flex items-center justify-center btn-cta btn-cta-sm"
                  style={{ borderRadius: 'var(--control-radius)' }}
                >
                  Subscribe
                </Link>
              </div>
            )}

            <button
              type="button"
              className="lg:hidden h-11 w-11 -mr-2.5 inline-flex items-center justify-center text-[var(--text)]"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              data-testid="mockup-header-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer; the app has its own menu */}
        {IS_APP_MODE && <AppMenu open={mobileOpen} onClose={() => setMobileOpen(false)} anchorRef={headerRef} />}
        {mobileOpen && !IS_APP_MODE && (
          <div id="mobile-nav" className="lg:hidden border-t border-[var(--rule)] py-6">
            <nav className="flex flex-col gap-5">
              {NAV.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`font-plex text-base ${
                    isActive(item.path)
                      ? 'text-[var(--accent-ink)]'
                      : 'text-[var(--text)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <span className="h-px w-full bg-[var(--rule)]" />
              {showAccountNav ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="font-plex text-base text-[var(--text)]"
                  >
                    {memberName ? memberName.split(' ')[0] : 'My Account'}
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left font-plex text-base text-[var(--text-muted)]"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="font-plex text-base text-[var(--text)]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center btn-cta w-fit"
                    style={{ borderRadius: 'var(--control-radius)' }}
                  >
                    Subscribe
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default MockupHeader;
