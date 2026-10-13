import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Newspaper, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { IS_APP_MODE } from '../lib/appMode';

const STALE_AFTER_MS = 30 * 60 * 1000;

/* Bottom tab bar, shown only when the site is opened from the home screen
   (lib/appMode.js). It slides away while a reader scrolls down and comes
   back on any scroll up, so a story gets the whole screen. Reopening the
   app after half an hour on the home page reloads it, so a new story is
   there without pull-to-refresh (which home-screen apps don't have). */
export const AppTabBar = () => {
  const { pathname } = useLocation();
  const { isLoggedIn } = useAuth();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (!IS_APP_MODE) return undefined;
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
      if (y < 80 || nearBottom || y < lastY.current - 6) setHidden(false);
      else if (y > lastY.current + 6) setHidden(true);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setHidden(false); }, [pathname]);

  useEffect(() => {
    if (!IS_APP_MODE) return undefined;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS && window.location.pathname === '/') {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!IS_APP_MODE || pathname.startsWith('/admin') || pathname.startsWith('/teams/manage')) return null;

  const tabs = [
    { to: '/', label: 'Home', Icon: Home, on: pathname === '/' },
    { to: '/archive', label: 'Archive', Icon: BookOpen, on: pathname.startsWith('/archive') },
    { to: '/left-field', label: 'Left Field', Icon: Newspaper, on: pathname.startsWith('/left-field') },
    isLoggedIn
      ? { to: '/account', label: 'Account', Icon: User, on: pathname.startsWith('/account') }
      : { to: '/login', label: 'Sign in', Icon: User, on: pathname.startsWith('/login') },
  ];

  return (
    <nav
      aria-label="App"
      data-testid="app-tab-bar"
      className={`app-tab-bar fixed inset-x-0 bottom-0 z-50 bg-[var(--nav-bg)] border-t border-[var(--rule)] transition-transform duration-200 ${hidden ? 'translate-y-full' : ''}`}
    >
      <ul className="flex justify-around max-w-[560px] mx-auto">
        {tabs.map(({ to, label, Icon, on }) => (
          <li key={label} className="flex-1">
            <Link
              to={to}
              aria-current={on ? 'page' : undefined}
              data-testid={`app-tab-${label.toLowerCase().replace(' ', '-')}`}
              className={`flex flex-col items-center justify-center gap-1 h-14 font-plex text-[11px] leading-none ${on ? 'text-[var(--accent-ink)]' : 'text-[var(--text-muted)]'}`}
            >
              <Icon className="h-[21px] w-[21px]" strokeWidth={on ? 1.9 : 1.5} aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default AppTabBar;
