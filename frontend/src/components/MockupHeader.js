import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X, Sun, Moon } from 'lucide-react';

const LOGO_LIGHT =
  'https://customer-assets.emergentagent.com/job_f68263cc-9957-4870-a972-878e48c308d2/artifacts/nka0eua2_TSOP_Logo_Transparent.png';
const LOGO_DARK =
  'https://customer-assets.emergentagent.com/job_f68263cc-9957-4870-a972-878e48c308d2/artifacts/nka0eua2_TSOP_Logo_Transparent.png';

const NAV = [
  { path: '/', label: 'Home' },
  { path: '/state-of-play', label: 'The State of Play' },
  { path: '/left-field', label: 'The Left Field' },
  { path: '/outfield', label: 'The Outfield' },
  { path: '/teams', label: 'For Teams' },
];

export const MockupHeader = () => {
  const { user, logout, canAccessPremium } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;
  const memberName =
    (user && (user.name || user.email?.split('@')[0])) ||
    (previewMember ? 'Venkatesh' : null);

  const isActive = (p) => location.pathname === p;

  return (
    <header
      data-testid="mockup-header"
      className="theme-transition sticky top-0 z-50 bg-[var(--nav-bg)] border-b border-[var(--rule)]"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-6">
          {/* Logo */}
          <Link
            to="/"
            data-testid="mockup-header-logo"
            className="flex items-center group shrink-0"
          >
            <img
              src={isDark ? LOGO_DARK : LOGO_LIGHT}
              alt="The State of Play"
              className={`h-10 lg:h-12 w-auto transition-opacity duration-200 group-hover:opacity-80 ${isDark ? 'invert' : ''}`}
            />
          </Link>

          {/* Desktop nav — Geist 15px */}
          <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
            {NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`mockup-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`font-plex text-[15px] transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-[var(--accent-burgundy)]'
                    : 'text-[var(--text)] hover:text-[var(--accent-burgundy)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right rail */}
          <div className="flex items-center gap-4 lg:gap-5 shrink-0">
            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="mockup-header-theme-toggle"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="h-9 w-9 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-200"
            >
              {isDark
                ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} />
                : <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />}
            </button>

            {isMember ? (
              <div className="hidden sm:flex items-center gap-5">
                <Link
                  to="/account"
                  data-testid="mockup-header-account"
                  className="font-plex text-[15px] text-[var(--text)] hover:text-[var(--accent-burgundy)] transition-colors duration-200"
                >
                  {memberName ? memberName.split(' ')[0] : 'My Account'}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  data-testid="mockup-header-logout"
                  className="font-plex text-[15px] text-[var(--text-muted)] hover:text-[var(--accent-burgundy)] transition-colors duration-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-6">
                <Link
                  to="/login"
                  data-testid="mockup-header-login"
                  className="font-plex text-[15px] text-[var(--text)] hover:text-[var(--accent-burgundy)] transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  data-testid="mockup-header-subscribe"
                  className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] tracking-wide h-12 px-5 transition-colors duration-200"
                  style={{ borderRadius: 0 }}
                >
                  Subscribe
                </Link>
              </div>
            )}

            <button
              type="button"
              className="lg:hidden h-9 w-9 inline-flex items-center justify-center text-[var(--text)]"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
              data-testid="mockup-header-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[var(--rule)] py-6">
            <nav className="flex flex-col gap-5">
              {NAV.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`font-plex text-base ${
                    isActive(item.path)
                      ? 'text-[var(--accent-burgundy)]'
                      : 'text-[var(--text)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <span className="h-px w-full bg-[var(--rule)]" />
              {isMember ? (
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
                    className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] text-white font-plex font-medium text-[14px] tracking-wide h-12 px-5 w-fit"
                    style={{ borderRadius: 0 }}
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
