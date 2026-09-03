import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Overline } from '../components/MockupLayout';
import { AdminNav } from '../components/admin/AdminNav';
import { SubscribersPanel } from '../components/admin/SubscribersPanel';
import { RenewalsPanel } from '../components/admin/RenewalsPanel';
import { BackfillPanel } from '../components/admin/BackfillPanel';

// Phase 1 shipped the shell + nav; Phase 2 (Subscribers/Renewals/the
// payments ledger) is real below. Each remaining panel is real once its
// own phase lands (Phase 3: Comments/Nominated readers/Trials/Referrals;
// Phase 4: Corporate accounts; Phase 5: Links). Placeholder, not fake
// data -- says plainly what's coming rather than showing invented
// numbers.
const ComingSoonPanel = ({ title, phase }) => (
  <div className="max-w-[560px]">
    <h2 className="font-editorial font-semibold text-[22px] leading-tight mb-3">{title}</h2>
    <p className="font-plex text-[14px] text-[var(--text-muted)] leading-relaxed">
      Not built yet — this is {phase} of the dashboard build.
    </p>
  </div>
);

const OverviewPanel = ({ onAuthError }) => (
  <div>
    <h2 className="font-editorial font-semibold text-[22px] leading-tight mb-3">
      Signed in.
    </h2>
    <p className="font-plex text-[14px] text-[var(--text-muted)] leading-relaxed mb-8 max-w-[560px]">
      Subscribers and Renewals are live. Everything else lands in the
      phases that follow.
    </p>
    <BackfillPanel onAuthError={onAuthError} />
  </div>
);

const DashboardHeader = () => {
  const { adminEmail, logout } = useAdminAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-6 flex items-baseline justify-between">
      <div>
        <Overline className="block mb-1">— The State of Play —</Overline>
        <h1 className="font-editorial font-semibold text-[28px] lg:text-[32px] leading-tight">
          Admin <em className="italic font-normal">dashboard.</em>
        </h1>
      </div>
      <div className="text-right">
        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-1">
          Signed in as {adminEmail}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          data-testid="admin-sign-out"
          className="font-plex text-[13px] text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors"
        >
          Sign out →
        </button>
      </div>
    </div>
  );
};

export const AdminDashboard = () => {
  const { isAdminLoggedIn, loading } = useAdminAuth();
  const navigate = useNavigate();

  // Same discipline as AccountMockup.js's reader gate: redirect in an
  // effect, never inline during render, and never render the real page
  // until we're certain about the session -- that exact race (a premature
  // redirect racing the async session check) was a real, fixed bug
  // earlier in this codebase.
  useEffect(() => {
    if (!loading && !isAdminLoggedIn) navigate('/admin/login', { replace: true });
  }, [loading, isAdminLoggedIn, navigate]);

  if (loading || !isAdminLoggedIn) {
    return null;
  }

  // Every panel's data hook calls this on a 401/403 from adminFetch --
  // the stale token is already cleared by adminFetch itself, this just
  // sends the reader back to sign in again instead of showing a
  // confusing empty table.
  const onAuthError = () => navigate('/admin/login', { replace: true });

  return (
    <div data-testid="page-admin-dashboard" className="theme-transition min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <DashboardHeader />
      <AdminNav />
      <main className="max-w-[1280px] mx-auto px-6 lg:px-12 py-10">
        <Routes>
          <Route index element={<OverviewPanel onAuthError={onAuthError} />} />
          <Route path="subscribers" element={<SubscribersPanel onAuthError={onAuthError} />} />
          <Route path="renewals" element={<RenewalsPanel onAuthError={onAuthError} />} />
          <Route path="comments" element={<ComingSoonPanel title="Comments" phase="Phase 3" />} />
          <Route path="nominated" element={<ComingSoonPanel title="Nominated readers" phase="Phase 3" />} />
          <Route path="corporate" element={<ComingSoonPanel title="Corporate accounts" phase="Phase 4" />} />
          <Route path="trials" element={<ComingSoonPanel title="Trials" phase="Phase 3" />} />
          <Route path="referrals" element={<ComingSoonPanel title="Referrals" phase="Phase 3" />} />
          <Route path="links" element={<ComingSoonPanel title="Links" phase="Phase 5" />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
