import { NavLink, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const LOGO_SRC = '/tsop-logo.png';
const BASE = '/admin/dashboard';

// The one map of the dashboard: the sidebar, the phone tabs and each
// page's title all come from here. `path` is relative to BASE; old
// addresses (/subscribers, /renewals, ...) are unchanged.
export const NAV_GROUPS = [
  {
    key: 'today', label: 'Today',
    pages: [{ path: '', label: 'Today', title: 'Today', description: 'What needs you, and the numbers that matter.' }],
  },
  {
    key: 'members', label: 'Members',
    pages: [
      { path: 'subscribers', label: 'Subscribers', title: 'Subscribers', description: 'Everyone on Ghost, with what they paid and when their year ends.' },
      { path: 'trials', label: 'The Ten', title: 'The Ten', description: 'Readers on the ₹590 trial and the stories they unlocked.' },
      { path: 'students', label: 'Students', title: 'Student applications', description: 'Approve an application and the payment link goes out.' },
      { path: 'nominated', label: 'Nominated', title: 'Nominated readers', description: 'Readers a subscriber gave 14 days of access.' },
      { path: 'corporate', label: 'Corporate', title: 'Corporate accounts', description: 'Team plans and their seats.' },
      { path: 'free-signups', label: 'Free signups', title: 'Free signups', description: 'Readers who registered for free.' },
    ],
  },
  {
    key: 'money', label: 'Money',
    pages: [
      { path: 'renewals', label: 'Renewals', title: 'Renewals', description: 'Whose year ends when, and the renewal emails.' },
      { path: 'sources', label: 'Sources', title: 'Sources', description: 'Where sign-ups and payments came from.' },
    ],
  },
  {
    key: 'comments', label: 'Comments',
    pages: [{ path: 'comments', label: 'Comments', title: 'Comments', description: 'Reader comments waiting for review.' }],
  },
  {
    key: 'tools', label: 'Tools',
    pages: [
      { path: 'tools/complimentary', label: 'Complimentary years', title: 'Give a complimentary year', description: 'A free year for someone you choose. They get a note from you now, and the renewal offer when it ends.' },
      { path: 'tools/link-email', label: 'Link a payment email', title: 'Link a payment email', description: 'For someone who paid in Razorpay with a different email than the one they sign in with.' },
      { path: 'tools/left-field', label: 'Left Field readers', title: 'Left Field readers', description: 'The list for the ₹2,499 Left Field offer, open until 31 October.' },
      { path: 'tools/import', label: 'Import past payments', title: 'Import past payments', description: 'Pulls payments from Razorpay into the dashboard. Safe to run again.' },
      { path: 'links', label: 'Links', title: 'Links', description: 'Cold and gift access links you have sent.' },
    ],
  },
];

const href = (path) => (path ? `${BASE}/${path}` : BASE);

// The group and page for the current address ('/admin/dashboard/renewals'
// → Money, Renewals). Unknown paths fall back to Today.
export const useCurrentPage = () => {
  const { pathname } = useLocation();
  const rest = pathname.replace(/\/+$/, '').slice(BASE.length).replace(/^\//, '');
  for (const group of NAV_GROUPS) {
    const page = group.pages.find((p) => p.path === rest);
    if (page) return { group, page };
  }
  return { group: NAV_GROUPS[0], page: NAV_GROUPS[0].pages[0] };
};

const Logo = ({ className }) => {
  const { isDark } = useTheme();
  return (
    <img
      src={LOGO_SRC}
      alt="The State of Play"
      className={`${className} w-auto ${isDark ? 'brightness-0 invert' : ''}`}
    />
  );
};

export const AdminSidebar = ({ adminEmail, onSignOut }) => {
  const { page: current } = useCurrentPage();
  const { isDark, toggleTheme } = useTheme();
  return (
    <aside
      data-testid="admin-sidebar"
      className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-[var(--surface)] border-r border-[var(--rule)]"
    >
      <NavLink to={BASE} className="block px-6 pt-7 pb-6 border-b border-[var(--rule)]">
        <Logo className="h-9" />
        <span className="section-label block mt-3 text-[var(--text-label)]">Admin</span>
      </NavLink>
      <nav className="flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-5" aria-label="Dashboard">
        {NAV_GROUPS.map((group) => (
          <div key={group.key}>
            {group.pages.length > 1 && (
              <p className="section-label px-3 mb-1.5 text-[var(--text-label)]">{group.label}</p>
            )}
            <ul className="flex flex-col">
              {group.pages.map((p) => {
                const active = p === current;
                return (
                  <li key={p.path}>
                    <NavLink
                      to={href(p.path)}
                      end
                      aria-current={active ? 'page' : undefined}
                      data-testid={`admin-nav-${p.path.replace('/', '-') || 'today'}`}
                      className={`block font-plex text-[14px] leading-snug px-3 py-1.5 border-l-2 transition-colors ${
                        active
                          ? 'border-[var(--accent-burgundy)] text-[var(--accent-burgundy)] font-medium'
                          : 'border-transparent text-[var(--text)] hover:text-[var(--accent-burgundy)]'
                      }`}
                    >
                      {p.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-6 py-5 border-t border-[var(--rule)]">
        <p className="font-plex text-[12px] text-[var(--text-muted)] truncate mb-2" title={adminEmail}>{adminEmail}</p>
        <div className="flex items-center justify-between">
          <button
            type="button" onClick={onSignOut} data-testid="admin-sign-out"
            className="font-plex text-[13px] text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)]"
          >
            Sign out
          </button>
          <button
            type="button" onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
};

export const AdminMobileNav = ({ onSignOut }) => {
  const { group: currentGroup, page: current } = useCurrentPage();
  return (
    <div data-testid="admin-mobile-nav" className="lg:hidden sticky top-0 z-40 bg-[var(--bg)] border-b border-[var(--rule)]">
      <div className="flex items-center justify-between px-4 h-14">
        <NavLink to={BASE} className="flex items-center gap-2">
          <Logo className="h-7" />
          <span className="section-label text-[var(--text-label)]">Admin</span>
        </NavLink>
        <button
          type="button" onClick={onSignOut}
          className="font-plex text-[13px] text-[var(--text-muted)] underline underline-offset-4"
        >
          Sign out
        </button>
      </div>
      <nav className="grid grid-cols-5 border-t border-[var(--rule)]" aria-label="Dashboard sections">
        {NAV_GROUPS.map((group) => {
          const active = group === currentGroup;
          return (
            <NavLink
              key={group.key}
              to={href(group.pages[0].path)}
              end
              className={`text-center font-plex text-[11px] uppercase tracking-[0.06em] py-3 border-b-2 ${
                active ? 'border-[var(--accent-burgundy)] text-[var(--text)]' : 'border-transparent text-[var(--text-muted)]'
              }`}
            >
              {group.label}
            </NavLink>
          );
        })}
      </nav>
      {currentGroup.pages.length > 1 && (
        <nav className="flex gap-5 overflow-x-auto px-4 py-2.5 bg-[var(--surface)] whitespace-nowrap" aria-label={currentGroup.label}>
          {currentGroup.pages.map((p) => (
            <NavLink
              key={p.path}
              to={href(p.path)}
              end
              className={`font-plex text-[13px] ${p === current ? 'text-[var(--accent-burgundy)] font-medium' : 'text-[var(--text-muted)]'}`}
            >
              {p.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};

export default AdminSidebar;
