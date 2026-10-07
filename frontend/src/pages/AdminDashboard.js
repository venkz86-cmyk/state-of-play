import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminSidebar, AdminMobileNav, useCurrentPage } from '../components/admin/AdminNav';
import { SubscribersPanel } from '../components/admin/SubscribersPanel';
import { RenewalsPanel } from '../components/admin/RenewalsPanel';
import { CommentsPanel } from '../components/admin/CommentsPanel';
import { NominatedReadersPanel } from '../components/admin/NominatedReadersPanel';
import { TrialsPanel } from '../components/admin/TrialsPanel';
import { StudentApplicationsPanel } from '../components/admin/StudentApplicationsPanel';
import { CorporateAccountsPanel } from '../components/admin/CorporateAccountsPanel';
import { LinksPanel } from '../components/admin/LinksPanel';
import { SourcesPanel } from '../components/admin/SourcesPanel';
import { OverviewPanel } from '../components/admin/OverviewPanel';
import { FreeRegistrationsPanel } from '../components/admin/FreeRegistrationsPanel';
import { LinkPaymentEmail } from '../components/admin/LinkPaymentEmail';
import { LeftFieldReadersPanel } from '../components/admin/LeftFieldReadersPanel';
import { BackfillPanel } from '../components/admin/BackfillPanel';

const todayLine = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// Every page opens with its title and one line on what it's for, from
// AdminNav's NAV_GROUPS, so the panels themselves carry no headings.
const PageHeader = () => {
  const { group, page } = useCurrentPage();
  const isToday = group.key === 'today';
  return (
    <header className="mb-8 lg:mb-10">
      {!isToday && group.pages.length > 1 && (
        <p className="section-label text-[var(--text-label)] mb-2">{group.label}</p>
      )}
      <h1 data-testid="admin-page-title" className="font-editorial text-[30px] lg:text-[40px] leading-[1.05] tracking-tight mb-2">
        {isToday ? todayLine() : page.title}
      </h1>
      <p className="font-plex text-[15px] text-[var(--text-muted)] max-w-[60ch]">{page.description}</p>
    </header>
  );
};

export const AdminDashboard = () => {
  const { isAdminLoggedIn, loading, adminEmail, logout } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdminLoggedIn) navigate('/admin/login', { replace: true });
  }, [loading, isAdminLoggedIn, navigate]);

  if (loading || !isAdminLoggedIn) {
    return null;
  }

  const onAuthError = () => navigate('/admin/login', { replace: true });
  const onSignOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div data-testid="page-admin-dashboard" className="theme-transition min-h-screen bg-[var(--bg)] text-[var(--text)] lg:flex">
      <AdminSidebar adminEmail={adminEmail} onSignOut={onSignOut} />
      <div className="flex-1 min-w-0">
        <AdminMobileNav onSignOut={onSignOut} />
        <main className="max-w-[1160px] px-4 sm:px-6 lg:px-12 py-8 lg:py-12">
          <PageHeader />
          <Routes>
            <Route index element={<OverviewPanel onAuthError={onAuthError} />} />
            <Route path="subscribers" element={<SubscribersPanel onAuthError={onAuthError} />} />
            <Route path="renewals" element={<RenewalsPanel onAuthError={onAuthError} />} />
            <Route path="comments" element={<CommentsPanel onAuthError={onAuthError} />} />
            <Route path="nominated" element={<NominatedReadersPanel onAuthError={onAuthError} />} />
            <Route path="corporate" element={<CorporateAccountsPanel onAuthError={onAuthError} />} />
            <Route path="trials" element={<TrialsPanel onAuthError={onAuthError} />} />
            <Route path="students" element={<StudentApplicationsPanel onAuthError={onAuthError} />} />
            <Route path="links" element={<LinksPanel onAuthError={onAuthError} />} />
            <Route path="sources" element={<SourcesPanel onAuthError={onAuthError} />} />
            <Route path="free-signups" element={<FreeRegistrationsPanel onAuthError={onAuthError} />} />
            <Route path="tools" element={<Navigate to="link-email" replace />} />
            <Route path="tools/link-email" element={<LinkPaymentEmail onAuthError={onAuthError} />} />
            <Route path="tools/left-field" element={<LeftFieldReadersPanel onAuthError={onAuthError} />} />
            <Route path="tools/import" element={<BackfillPanel onAuthError={onAuthError} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
