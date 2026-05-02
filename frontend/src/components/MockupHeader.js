import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X, Search, ArrowUpRight } from 'lucide-react';

const LOGO_LIGHT =
  'https://customer-assets.emergentagent.com/job_leftfield-hub/artifacts/fx9mc000_TSOP-Logo%20Final%3AColour.jpg';
const LOGO_DARK =
  'https://customer-assets.emergentagent.com/job_dcd955ba-7b95-4793-aa4a-cd2ca65f8014/artifacts/gykve31s_Publication%20Icon.jpg';

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
              className="h-9 lg:h-10 w-auto transition-opacity duration-200 group-hover:opacity-80"
            />
          </Link>

          {/* Desktop nav — mono caps, sharp underlines */}
          <nav className="hidden lg:flex items-center gap-7 flex-1 justify-center">
            {NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`mockup-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`relative font-plex-mono text-[11px] font-medium tracking-[0.22em] uppercase transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-[#234ba0]'
                    : 'text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0]'
                }`}
              >
                {item.label}
                {isActive(item.path) && (
                  <span className="absolute -bottom-2 left-0 right-0 h-px bg-[#234ba0]" />
                )}
              </Link>
            ))}
          </nav>

          {/* Right rail — search + auth + subscribe */}
          <div className="flex items-center gap-3 lg:gap-5 shrink-0">
            <button
              type="button"
              aria-label="Search"
              data-testid="mockup-header-search"
              className="hidden sm:inline-flex h-9 w-9 items-center justify-center text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0] transition-colors duration-200"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </button>

            {isMember ? (
              <div className="hidden sm:flex items-center gap-3">
                <Link
                  to="/account"
                  data-testid="mockup-header-account"
                  className="flex items-center gap-2 group"
                >
                  <span className="h-8 w-8 bg-[#0F172A] dark:bg-[#F8FAFC] text-[#F7F7F5] dark:text-[#090E17] flex items-center justify-center font-editorial text-sm">
                    {memberName ? memberName.charAt(0).toUpperCase() : 'M'}
                  </span>
                  <span className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#234ba0] transition-colors duration-200">
                    {memberName || 'Member'}
                  </span>
                </Link>
                <span className="h-4 w-px bg-[#0F172A]/15 dark:bg-[#F8FAFC]/15" />
                <button
                  type="button"
                  onClick={logout}
                  data-testid="mockup-header-logout"
                  className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#475569] dark:text-[#94A3B8] hover:text-[#234ba0] transition-colors duration-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-5">
                <Link
                  to="/login"
                  data-testid="mockup-header-login"
                  className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#234ba0] transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  data-testid="mockup-header-subscribe"
                  className="inline-flex items-center gap-2 bg-[#FF6B35] hover:bg-[#e55e2d] text-white font-plex font-semibold text-sm px-5 py-2.5 transition-colors duration-200"
                >
                  Subscribe
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
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
                  className={`font-plex-mono text-[11px] tracking-[0.22em] uppercase ${
                    isActive(item.path)
                      ? 'text-[#234ba0]'
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
                    className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    Member Lounge
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#475569]"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex w-fit items-center gap-2 bg-[#FF6B35] text-white font-plex font-semibold text-sm px-5 py-2.5"
                  >
                    Subscribe
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
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
