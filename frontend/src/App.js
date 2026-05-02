import "@/index.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { BackToTop } from "./components/BackToTop";
import { Home } from "./pages/Home";
import { StateOfPlay } from "./pages/StateOfPlay";
import { LeftField } from "./pages/LeftField";
import { ArticlePage } from "./pages/ArticlePage";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { MemberDashboard } from "./pages/MemberDashboard";
import { Welcome } from "./pages/Welcome";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";
import { Membership } from "./pages/Membership";
import { Outfield } from "./pages/Outfield";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { Archive } from "./pages/Archive";
import { Teams } from "./pages/Teams";
import { TeamsManage } from "./pages/TeamsManage";
import { Partnerships } from "./pages/Partnerships";
import { HomeMockup } from "./pages/HomeMockup";
import { ArticleMockup } from "./pages/ArticleMockup";
import { MockupIndex } from "./pages/MockupIndex";
import { FeedMockup } from "./pages/FeedMockup";
import { SubscribeMockup } from "./pages/SubscribeMockup";
import { AboutMockup } from "./pages/AboutMockup";
import { TeamsMockup } from "./pages/TeamsMockup";
import { OutfieldMockup } from "./pages/OutfieldMockup";
import { LoginMockup } from "./pages/LoginMockup";
import { AccountMockup } from "./pages/AccountMockup";
import { LeftFieldMockup } from "./pages/LeftFieldMockup";
import { Toaster } from "./components/ui/sonner";

function Shell() {
  const location = useLocation();
  const isMockup = location.pathname.startsWith('/mockup');
  return (
    <div className="App min-h-screen flex flex-col bg-background text-foreground">
      {!isMockup && <Header />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/state-of-play" element={<StateOfPlay />} />
          <Route path="/left-field" element={<LeftField />} />
          <Route path="/outfield" element={<Outfield />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account" element={<MemberDashboard />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/manage" element={<TeamsManage />} />
          <Route path="/partnerships" element={<Partnerships />} />
          <Route path="/mockup" element={<MockupIndex />} />
          <Route path="/mockup/home" element={<HomeMockup />} />
          <Route path="/mockup/feed" element={<FeedMockup />} />
          <Route path="/mockup/subscribe" element={<SubscribeMockup />} />
          <Route path="/mockup/about" element={<AboutMockup />} />
          <Route path="/mockup/teams" element={<TeamsMockup />} />
          <Route path="/mockup/outfield" element={<OutfieldMockup />} />
          <Route path="/mockup/left-field" element={<LeftFieldMockup />} />
          <Route path="/mockup/login" element={<LoginMockup />} />
          <Route path="/mockup/account" element={<AccountMockup />} />
          <Route path="/mockup/article/:id" element={<ArticleMockup />} />
          <Route path="/mockup/article" element={<ArticleMockup />} />
          {/* Article route MUST be last - catches /:slug */}
          <Route path="/:id" element={<ArticlePage />} />
        </Routes>
      </main>
      {!isMockup && <Footer />}
      <BackToTop />
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
