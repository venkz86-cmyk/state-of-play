import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/admin/dashboard', label: 'Overview', end: true },
  { to: '/admin/dashboard/subscribers', label: 'Subscribers' },
  { to: '/admin/dashboard/renewals', label: 'Renewals' },
  { to: '/admin/dashboard/comments', label: 'Comments' },
  { to: '/admin/dashboard/nominated', label: 'Nominated readers' },
  { to: '/admin/dashboard/corporate', label: 'Corporate accounts' },
  { to: '/admin/dashboard/trials', label: 'Trials' },
  // Referrals hidden from nav until the reader-facing referral product
  // actually launches -- the tab/route/backend all still work, just not
  // surfaced, so nothing has to be rebuilt when it's ready.
  { to: '/admin/dashboard/links', label: 'Links' },
];

export const AdminNav = () => (
  <nav className="border-b border-[var(--rule)] overflow-x-auto">
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex gap-8 whitespace-nowrap">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `font-plex text-[13px] uppercase tracking-[0.05em] py-4 border-b-2 transition-colors ${
              isActive
                ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  </nav>
);

export default AdminNav;
