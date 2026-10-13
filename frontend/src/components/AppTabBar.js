import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IS_APP_MODE } from '../lib/appMode';

const STALE_AFTER_MS = 30 * 60 * 1000;

/* Bottom tab bar, shown only when the site is opened from the home screen
   (lib/appMode.js): Home, Left Field, Search, You. Chosen from how readers
   use a weekly publication: the latest stories, the twice-weekly Left
   Field, looking up an old story by name, and stories saved for later.

   It borrows from the logo. The icons are drawn in the logo's square line
   (no rounded ends), Home is the logo's open frame with lines of type, and
   the current tab is in the logo's blue with the frame's top corner above
   it.

   Every tap is sent to Google Analytics as an 'app_tab' event, so which
   tabs get used decides what stays. It slides away while a reader scrolls
   down and comes back on any scroll up, so a story gets the whole screen.
   Reopening the app after half an hour on the home page reloads it, so a
   new story is there without pull-to-refresh (which home-screen apps
   don't have). */
const Icon = ({ name, on }) => {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: on ? 2.1 : 1.6, strokeLinecap: 'square', strokeLinejoin: 'miter' };
  const tint = { fill: 'currentColor', fillOpacity: on ? 0.16 : 0 };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="block">
      {name === 'home' && (
        <>
          <path d="M8 3.5H20.5V20.5H11" {...stroke} />
          <rect x="3" y="7" width="11" height="2.4" fill="currentColor" />
          <rect x="3" y="11" width="13" height="2.4" fill="currentColor" />
          <rect x="3" y="15" width="8" height="2.4" fill="currentColor" />
        </>
      )}
      {name === 'left-field' && (
        <>
          {/* a pitch from above, its left side filled in */}
          <rect x="2.5" y="5" width="19" height="14" {...stroke} />
          <path d="M12 5V19" {...stroke} strokeWidth={1.4} />
          <circle cx="12" cy="12" r="2.9" {...stroke} strokeWidth={1.4} />
          <rect x="2.5" y="5" width="4.5" height="14" fill="currentColor" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" {...stroke} {...tint} />
          <path d="M15.5 15.5L20.5 20.5" {...stroke} strokeWidth={on ? 2.6 : 2.1} />
        </>
      )}
      {name === 'you' && (
        <>
          <path d="M6 3.5H18V20.5L12 16L6 20.5Z" {...stroke} {...tint} />
        </>
      )}
    </svg>
  );
};

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
    { to: '/', label: 'Home', icon: 'home', on: pathname === '/' },
    { to: '/left-field', label: 'Left Field', icon: 'left-field', on: pathname.startsWith('/left-field') },
    { to: '/search', label: 'Search', icon: 'search', on: pathname.startsWith('/search') || pathname.startsWith('/archive') || pathname.startsWith('/topic/') },
    { to: '/you', label: 'You', icon: 'you', on: pathname.startsWith('/you') || pathname.startsWith('/account') || pathname === '/app' },
  ];
  const track = (tab) => {
    try { window.gtag && window.gtag('event', 'app_tab', { tab, from: pathname }); } catch (e) { /* analytics never blocks a tap */ }
  };

  return (
    <nav
      aria-label="App"
      data-testid="app-tab-bar"
      className={`app-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-[var(--rule)] backdrop-blur-xl transition-transform duration-200 ${hidden ? 'translate-y-full' : ''}`}
    >
      <ul className="flex max-w-[560px] mx-auto px-1">
        {tabs.map(({ to, label, icon, on }) => (
          <li key={label} className="flex-1 relative">
            {/* the top corner of the logo's frame, over the current tab */}
            <span aria-hidden="true"
              className={`absolute top-[-1px] left-[22%] right-[22%] h-[7px] border-t-[2.5px] border-r-[2.5px] border-[var(--accent-blue)] transition-opacity duration-200 ${on ? 'opacity-100' : 'opacity-0'}`} />
            <Link
              to={to}
              onClick={() => track(label)}
              aria-current={on ? 'page' : undefined}
              data-testid={`app-tab-${label.toLowerCase().replace(' ', '-')}`}
              className={`app-tab flex flex-col items-center justify-center gap-[5px] h-[58px] transition-colors ${on ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)]'}`}
            >
              <Icon name={icon} on={on} />
              <span className={`text-[11px] leading-none tracking-[0.02em] ${on ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default AppTabBar;
