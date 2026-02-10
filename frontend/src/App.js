import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";
import { Membership } from "./pages/Membership";
import { Outfield } from "./pages/Outfield";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { Archive } from "./pages/Archive";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="App min-h-screen flex flex-col bg-background text-foreground">
            <Header />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/state-of-play" element={<StateOfPlay />} />
                <Route path="/left-field" element={<LeftField />} />
                <Route path="/outfield" element={<Outfield />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/membership" element={<Membership />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/archive" element={<Archive />} />
                {/* Article route MUST be last - catches /:slug */}
                <Route path="/:id" element={<ArticlePage />} />
              </Routes>
            </main>
            <Footer />
            <BackToTop />
            <Toaster position="top-right" />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
