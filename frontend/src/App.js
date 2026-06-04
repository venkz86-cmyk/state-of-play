import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MockupBackToTop } from "./components/MockupBackToTop";
// Live page components (renamed → driven by the new editorial designs)
import { HomeMockup as Home } from "./pages/HomeMockup";
import { ArticleMockup as ArticlePage } from "./pages/ArticleMockup";
import { FeedMockup as StateOfPlay } from "./pages/FeedMockup";
import { LeftFieldMockup as LeftField } from "./pages/LeftFieldMockup";
import { OutfieldMockup as Outfield } from "./pages/OutfieldMockup";
import { LoginMockup as Login } from "./pages/LoginMockup";
import { SubscribeMockup as Signup } from "./pages/SubscribeMockup";
import { AccountMockup as MemberDashboard } from "./pages/AccountMockup";
import { AboutMockup as About } from "./pages/AboutMockup";
import { ContactMockup as Contact } from "./pages/ContactMockup";
import { TeamsMockup as Teams } from "./pages/TeamsMockup";
import { PartnershipsMockup as Partnerships } from "./pages/PartnershipsMockup";
import { TermsMockup as Terms } from "./pages/TermsMockup";
import { PrivacyMockup as Privacy } from "./pages/PrivacyMockup";
import { NotFoundMockup as NotFound } from "./pages/NotFoundMockup";
import { InvoicePreviewMockup } from "./pages/InvoicePreviewMockup";
// Keep the mockup index reachable for future review
import { MockupIndex } from "./pages/MockupIndex";
import { TeamsManage } from "./pages/TeamsManage";
import { Toaster } from "./components/ui/sonner";

function Shell() {
  return (
    <div className="App theme-transition min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <main className="flex-grow">
        <Routes>
          {/* Production URLs — preserved exactly */}
          <Route path="/" element={<Home />} />
          <Route path="/state-of-play" element={<StateOfPlay />} />
          <Route path="/left-field" element={<LeftField />} />
          <Route path="/outfield" element={<Outfield />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<MemberDashboard />} />
          <Route path="/account" element={<MemberDashboard />} />
          <Route path="/welcome" element={<MemberDashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/membership" element={<Signup />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/archive" element={<StateOfPlay />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/manage" element={<TeamsManage />} />
          <Route path="/partnerships" element={<Partnerships />} />

          {/* Mockup review index — kept for future design previews */}
          <Route path="/mockup" element={<MockupIndex />} />
          <Route path="/mockup/invoice" element={<InvoicePreviewMockup />} />

          {/* Article catch-all (Ghost slug). MUST be last. */}
          <Route path="/:id" element={<ArticlePage />} />

          {/* Custom 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <MockupBackToTop />
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
