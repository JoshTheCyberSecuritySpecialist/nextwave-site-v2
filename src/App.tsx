import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";

/* Layout */
import { MainLayout } from "./layouts/MainLayout";

/* Pages */
import { Home } from "./pages/Home";
import { Services } from "./pages/Services";
import { WebDevelopment } from "./pages/WebDevelopment";
import { Cybersecurity } from "./pages/Cybersecurity";
import { AutomationAI } from "./pages/AutomationAI";
import { LocalITSupport } from "./pages/LocalITSupport";
import { Portfolio } from "./pages/Portfolio";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";
import { Blog } from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BlogAdmin from "./pages/BlogAdmin";

/* Auth */
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

/* Scroll to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/* App Routes */
function AppRoutes() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Redirect /home → / */}
        <Route path="/home" element={<Navigate to="/" replace />} />

        {/* Public Pages */}
        <Route
          path="/"
          element={
            <MainLayout currentPage="home" onNavigate={handleNavigate}>
              <Home onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        <Route
          path="/services"
          element={
            <MainLayout currentPage="services" onNavigate={handleNavigate}>
              <Services onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        <Route
          path="/web-development"
          element={
            <MainLayout currentPage="web-development" onNavigate={handleNavigate}>
              <WebDevelopment />
            </MainLayout>
          }
        />

        <Route
          path="/cybersecurity"
          element={
            <MainLayout currentPage="cybersecurity" onNavigate={handleNavigate}>
              <Cybersecurity />
            </MainLayout>
          }
        />

        <Route
          path="/automation-ai"
          element={
            <MainLayout currentPage="automation-ai" onNavigate={handleNavigate}>
              <AutomationAI />
            </MainLayout>
          }
        />

        <Route
          path="/local-it-support"
          element={
            <MainLayout currentPage="local-it-support" onNavigate={handleNavigate}>
              <LocalITSupport />
            </MainLayout>
          }
        />

        <Route
          path="/portfolio"
          element={
            <MainLayout currentPage="portfolio" onNavigate={handleNavigate}>
              <Portfolio />
            </MainLayout>
          }
        />

        <Route
          path="/about"
          element={
            <MainLayout currentPage="about" onNavigate={handleNavigate}>
              <About />
            </MainLayout>
          }
        />

        <Route
          path="/contact"
          element={
            <MainLayout currentPage="contact" onNavigate={handleNavigate}>
              <Contact />
            </MainLayout>
          }
        />

        {/* Blog */}
        <Route
          path="/blog"
          element={
            <MainLayout currentPage="blog" onNavigate={handleNavigate}>
              <Blog />
            </MainLayout>
          }
        />

        <Route
          path="/blog/:slug"
          element={
            <MainLayout currentPage="blog" onNavigate={handleNavigate}>
              <BlogPost />
            </MainLayout>
          }
        />

        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/blog-admin"
          element={
            <ProtectedRoute>
              <BlogAdmin />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
