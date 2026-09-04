import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Overline } from '../components/MockupLayout';
import { AdminNav } from '../components/admin/AdminNav';
import { SubscribersPanel } from '../components/admin/SubscribersPanel';
import { RenewalsPanel } from '../components/admin/RenewalsPanel';
import { CommentsPanel } from '../components/admin/CommentsPanel';
import { NominatedReadersPanel } from '../components/admin/NominatedReadersPanel';
import { TrialsPanel } from '../components/admin/TrialsPanel';
import { ReferralsPanel } from '../components/admin/ReferralsPanel';
import { CorporateAccountsPanel } from '../components/admin/CorporateAccountsPanel';
import { LinksPanel } from '../components/admin/LinksPanel';
import { OverviewPanel } from '../components/admin/OverviewPanel';

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
          <Route path="comments" element={<CommentsPanel onAuthError={onAuthError} />} />
          <Route path="nominated" element={<NominatedReadersPanel onAuthError={onAuthError} />} />
          <Route path="corporate" element={<CorporateAccountsPanel onAuthError={onAuthError} />} />
          <Route path="trials" element={<TrialsPanel onAuthError={onAuthError} />} />
          <Route path="referrals" element={<ReferralsPanel onAuthError={onAuthError} />} />
          <Route path="links" element={<LinksPanel onAuthError={onAuthError} />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
