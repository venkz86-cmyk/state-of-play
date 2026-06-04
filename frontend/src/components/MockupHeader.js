import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X } from 'lucide-react';

const LOGO_LIGHT =
  'https://customer-assets.emergentagent.com/job_f68263cc-9957-4870-a972-878e48c308d2/artifacts/nka0eua2_TSOP_Logo_Transparent.png';
const LOGO_DARK =
  'https://customer-assets.emergentagent.com/job_f68263cc-9957-4870-a972-878e48c308d2/artifacts/nka0eua2_TSOP_Logo_Transparent.png';

const NAV = [
  { path: '/mockup/home', label: 'Home' },
  { path: '/state-of-play', label: 'The State of Play' },
  { path: '/left-field', label: 'The Left Field' },
  { path: '/outfield', label: 'The Outfield' },
  { path: '/teams', label: 'For Teams' },
];

export const MockupHeader = () => {
  const { user, logout, canAccessPremium } = useAuth();
  const { isDark } = useTheme();
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
      className="sticky top-0 z-50 bg-[#F7F7F5]/85 dark:bg-[#090E17]/85 backdrop-blur-xl border-b border-[#0F172A]/10 dark:border-[#F8FAFC]/10"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-6">
          {/* Logo — restrained, no white card chrome */}
          <Link
            to="/mockup/home"
            data-testid="mockup-header-logo"
            className="flex items-center group shrink-0"
          >
            <img
              src={isDark ? LOGO_DARK : LOGO_LIGHT}
              alt="The State of Play"
              className="h-10 lg:h-12 w-auto transition-opacity duration-200 group-hover:opacity-80"
            />
          </Link>

          {/* Desktop nav — sentence case, restrained */}
          <nav className="hidden lg:flex items-center gap-7 flex-1 justify-center">
            {NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`mockup-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`font-plex text-sm transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-[var(--accent)]'
                    : 'text-[#0F172A] dark:text-[#F8FAFC] hover:text-[var(--accent)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right rail — auth links only, no search button (decorative until wired) */}
          <div className="flex items-center gap-3 lg:gap-5 shrink-0">

            {isMember ? (
              <div className="hidden sm:flex items-center gap-5">
                <Link
                  to="/account"
                  data-testid="mockup-header-account"
                  className="font-plex text-sm text-[#0F172A] dark:text-[#F8FAFC] hover:text-[var(--accent)] transition-colors duration-200"
                >
                  {memberName || 'Account'}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  data-testid="mockup-header-logout"
                  className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] hover:text-[var(--accent)] transition-colors duration-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-6">
                <Link
                  to="/login"
                  data-testid="mockup-header-login"
                  className="font-plex text-sm text-[#0F172A] dark:text-[#F8FAFC] hover:text-[var(--accent)] transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  data-testid="mockup-header-subscribe"
                  className="font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                >
                  Subscribe
                </Link>
              </div>
            )}

            <button
              type="button"
              className="lg:hidden h-9 w-9 inline-flex items-center justify-center text-[#0F172A] dark:text-[#F8FAFC]"
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
          <div className="lg:hidden border-t border-[#0F172A]/10 dark:border-[#F8FAFC]/10 py-6">
            <nav className="flex flex-col gap-5">
              {NAV.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`font-plex text-base ${
                    isActive(item.path)
                      ? 'text-[var(--accent)]'
                      : 'text-[#0F172A] dark:text-[#F8FAFC]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <span className="h-px w-full bg-[#0F172A]/10 dark:bg-[#F8FAFC]/10" />
              {isMember ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="font-plex text-base text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    Account
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left font-plex text-base text-[#475569]"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="font-plex text-base text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1"
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
