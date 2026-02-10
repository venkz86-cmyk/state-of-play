import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Header } from "./components/Header";
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
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App min-h-screen">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/state-of-play" element={<StateOfPlay />} />
            <Route path="/left-field" element={<LeftField />} />
            <Route path="/outfield" element={<Outfield />} />
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/membership" element={<Membership />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
