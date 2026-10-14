import "@/index.css";
import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { captureRef } from "./lib/attribution";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MockupBackToTop } from "./components/MockupBackToTop";
import { AppTabBar } from "./components/AppTabBar";
import { claimHandoff } from "./components/AppHandoff";
import { track } from "./lib/analytics";
// Live page components (renamed → driven by the new editorial designs)
import { HomeMockup as Home } from "./pages/HomeMockup";
import { ArticleMockup as ArticlePage } from "./pages/ArticleMockup";
import { FeedMockup as StateOfPlay } from "./pages/FeedMockup";
import { LeftFieldMockup as LeftField } from "./pages/LeftFieldMockup";
import { LeftFieldNote, LeftFieldEdition } from "./pages/LeftFieldNotes";
import { Archive } from "./pages/Archive";
import { OutfieldMockup as Outfield } from "./pages/OutfieldMockup";
import { LoginMockup as Login } from "./pages/LoginMockup";
import { SubscribeMockup as Signup } from "./pages/SubscribeMockup";
import { AccountMockup as MemberDashboard } from "./pages/AccountMockup";
import { AboutMockup as About } from "./pages/AboutMockup";
import { ContactMockup as Contact } from "./pages/ContactMockup";
import { TeamsMockup as Teams } from "./pages/TeamsMockup";
import { StudentsMockup as Students } from "./pages/StudentsMockup";
import { AppMockup } from "./pages/AppMockup";
import { SearchMockup } from "./pages/SearchMockup";
import { YouMockup } from "./pages/YouMockup";
import { IS_APP_MODE } from "./lib/appMode";
const StudentPay = lazy(() => import("./pages/StudentPayMockup").then((m) => ({ default: m.StudentPayMockup })));
import { GiftMockup as Gift } from "./pages/GiftMockup";
const GiftRedeem = lazy(() => import("./pages/GiftRedeemMockup").then((m) => ({ default: m.GiftRedeemMockup })));
const Renew = lazy(() => import("./pages/RenewMockup").then((m) => ({ default: m.RenewMockup })));
const MixedZone = lazy(() => import("./pages/MixedZoneMockup").then((m) => ({ default: m.MixedZoneMockup })));
const Invite = lazy(() => import("./pages/InviteMockup").then((m) => ({ default: m.InviteMockup })));
import { TrialMockup as Trial } from "./pages/TrialMockup";
const GroupStoryPage = lazy(() => import("./pages/GroupStoryPage").then((m) => ({ default: m.GroupStoryPage })));
import { SeasonMockup as Season } from "./pages/SeasonMockup";
import { StartHereMockup as StartHere } from "./pages/StartHereMockup";
import { PartnershipsMockup as Partnerships } from "./pages/PartnershipsMockup";
import { TermsMockup as Terms } from "./pages/TermsMockup";
import { PrivacyMockup as Privacy } from "./pages/PrivacyMockup";
import { NotFoundMockup as NotFound } from "./pages/NotFoundMockup";
const TeamsManage = lazy(() => import("./pages/TeamsManage").then((m) => ({ default: m.TeamsManage })));
const TeamsLogin = lazy(() => import("./pages/TeamsLogin").then((m) => ({ default: m.TeamsLogin })));
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { AdminLogin } from "./pages/AdminLogin";
// The dashboard only loads for admins, not in every reader's download.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
import { Toaster } from "./components/ui/sonner";

// One AdminAuthProvider instance shared by /admin/login and
// /admin/dashboard/* -- mounting a separate provider per route would lose
// the just-verified session in memory on navigation from login to
// dashboard, forcing an unnecessary extra /api/admin/auth/me round-trip
// and a loading flash. Nested here (not wrapping the whole app) so a
// normal reader's page load never touches this context at all.
function AdminArea() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="dashboard/*" element={<Suspense fallback={null}><AdminDashboard /></Suspense>} />
      </Routes>
    </AdminAuthProvider>
  );
}

function Shell() {
  const location = useLocation();
  useEffect(() => { captureRef(location.search, location.pathname); }, [location.search, location.pathname]);
  // A new page opens at the top. Back and forward (POP) are left alone, so
  // the browser returns the reader to where they were; a link to a section
  // (#anchor) scrolls there instead.
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== 'POP' && !location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash, navType]);
  // In the app: a story this phone handed over from its browser ("Read this
  // in the app", components/AppHandoff.js) opens as the app opens or comes
  // back to the front.
  const navigate = useNavigate();
  useEffect(() => {
    if (!IS_APP_MODE) return undefined;
    const check = async () => {
      const path = await claimHandoff();
      if (!path) return;
      track('app_handoff_open', { path });
      if (window.location.pathname !== path) navigate(`${path}?source=handoff`);
    };
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    check();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [navigate]);
  return (
    <div className="App theme-transition min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Each page draws its own <main> (after its header), so this is a plain wrapper. */}
      <div className="flex-grow">
        {/* Rarely visited pages load on demand; each shows its own loading state. */}
        <Suspense fallback={null}>
        <Routes>
          {/* Production URLs — preserved exactly */}
          <Route path="/" element={<Home />} />
          <Route path="/state-of-play" element={<StateOfPlay />} />
          <Route path="/left-field" element={<LeftField />} />
          <Route path="/left-field/e/:slug" element={<LeftFieldEdition />} />
          <Route path="/left-field/n/:id" element={<LeftFieldNote />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/topic/:slug" element={<Archive />} />
          <Route path="/outfield" element={<Outfield />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/subscribe" element={<Navigate to="/signup" replace />} />
          {/* In the app, the account lives in the You tab. */}
          <Route path="/dashboard" element={IS_APP_MODE ? <YouMockup /> : <MemberDashboard />} />
          <Route path="/account" element={IS_APP_MODE ? <YouMockup /> : <MemberDashboard />} />
          <Route path="/renew" element={<Renew />} />
          <Route path="/mixed-zone" element={<MixedZone />} />
          <Route path="/invite/:code" element={<Invite />} />
          <Route path="/g/:code" element={<GroupStoryPage />} />
          <Route path="/welcome" element={<MemberDashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/membership" element={<Signup />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/students" element={<Students />} />
          <Route path="/app" element={<AppMockup />} />
          <Route path="/search" element={<SearchMockup />} />
          <Route path="/you" element={<YouMockup />} />
          <Route path="/students/pay" element={<StudentPay />} />
          <Route path="/gift" element={<Gift />} />
          <Route path="/gift/redeem" element={<GiftRedeem />} />
          <Route path="/trial" element={<Trial />} />
          <Route path="/season-one" element={<Season />} />
          <Route path="/start-here" element={<StartHere />} />
          <Route path="/teams/manage" element={<TeamsManage />} />
          <Route path="/teams/login" element={<TeamsLogin />} />
          <Route path="/partnerships" element={<Partnerships />} />
          <Route path="/admin/comments" element={<Navigate to="/admin/dashboard/comments" replace />} />
          <Route path="/admin/*" element={<AdminArea />} />


          {/* Article catch-all (Ghost slug). MUST be last. */}
          <Route path="/:id" element={<ArticlePage />} />

          {/* Custom 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>
      <MockupBackToTop />
      <AppTabBar />
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
