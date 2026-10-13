import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IS_APP_MODE } from '../lib/appMode';

const STALE_AFTER_MS = 30 * 60 * 1000;

/* Bottom tab bar, shown only when the site is opened from the home screen
   (lib/appMode.js). Words, no icons: Home, Left Field, Search, You, set in
   the site's sans, with a small burgundy square under the current tab
   (the square in the logo's frame). Chosen from how readers use a weekly
   publication: the latest stories, the twice-weekly briefing, looking up
   an old story by name, and stories saved for later.

   Every tap is sent to Google Analytics as an 'app_tab' event, so which
   tabs get used decides what stays. It slides away while a reader scrolls
   down and comes back on any scroll up, so a story gets the whole screen.
   Reopening the app after half an hour on the home page reloads it, so a
   new story is there without pull-to-refresh (which home-screen apps
   don't have). */
export const AppTabBar = () => {
  const { pathname } = useLocation();
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
    { to: '/', label: 'Home', on: pathname === '/' },
    { to: '/left-field', label: 'Left Field', on: pathname.startsWith('/left-field') },
    { to: '/search', label: 'Search', on: pathname.startsWith('/search') || pathname.startsWith('/archive') || pathname.startsWith('/topic/') },
    { to: '/you', label: 'You', on: pathname.startsWith('/you') || pathname.startsWith('/account') || pathname === '/app' },
  ];
  const track = (tab) => {
    try { window.gtag && window.gtag('event', 'app_tab', { tab, from: pathname }); } catch (e) { /* analytics never blocks a tap */ }
  };

  return (
    <nav
      aria-label="App"
      data-testid="app-tab-bar"
      className={`app-tab-bar fixed inset-x-0 bottom-0 z-50 bg-[var(--nav-bg)] border-t border-[var(--rule)] transition-transform duration-200 ${hidden ? 'translate-y-full' : ''}`}
    >
      <ul className="flex max-w-[560px] mx-auto px-2">
        {tabs.map(({ to, label, on }) => (
          <li key={label} className="flex-1">
            <Link
              to={to}
              onClick={() => track(label)}
              aria-current={on ? 'page' : undefined}
              data-testid={`app-tab-${label.toLowerCase().replace(' ', '-')}`}
              className={`flex flex-col items-center justify-center gap-[7px] h-14 font-plex text-[14px] leading-none tracking-[0.01em] transition-colors ${on ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-muted)] font-medium'}`}
            >
              {label}
              <span aria-hidden="true" className={`block h-[5px] w-[5px] ${on ? 'bg-[var(--accent-ink)]' : 'bg-transparent'}`} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default AppTabBar;
