import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEffect } from 'react';

/* Layout */
import { MainLayout } from './layouts/MainLayout';

/* Pages */
import { Home } from './pages/Home';
import { Services } from './pages/Services';
import { WebDevelopment } from './pages/WebDevelopment';
import { Cybersecurity } from './pages/Cybersecurity';
import { AutomationAI } from './pages/AutomationAI';
import { LocalITSupport } from './pages/LocalITSupport';
import { Portfolio } from './pages/Portfolio';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Blog } from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BlogAdmin from './pages/BlogAdmin';

/* Auth */
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

/* Scroll to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/* App Routes */
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage =
    location.pathname === '/'
      ? 'home'
      : location.pathname.split('/')[1];

  const handleNavigate = (page: string) => {
    navigate(`/${page}`);
  };

  return (
    <>
      <ScrollToTop />

      <Routes>
        {/* Home */}
        <Route
          path="/"
          element={
            <MainLayout currentPage="home" onNavigate={handleNavigate}>
              <Home onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        {/* Services */}
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
              <WebDevelopment onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        <Route
          path="/cybersecurity"
          element={
            <MainLayout currentPage="cybersecurity" onNavigate={handleNavigate}>
              <Cybersecurity onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        <Route
          path="/automation-ai"
          element={
            <MainLayout currentPage="automation-ai" onNavigate={handleNavigate}>
              <AutomationAI onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        <Route
          path="/local-it-support"
          element={
            <MainLayout currentPage="local-it-support" onNavigate={handleNavigate}>
              <LocalITSupport onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        {/* Portfolio */}
        <Route
          path="/portfolio"
          element={
            <MainLayout currentPage="portfolio" onNavigate={handleNavigate}>
              <Portfolio onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        {/* About */}
        <Route
          path="/about"
          element={
            <MainLayout currentPage="about" onNavigate={handleNavigate}>
              <About onNavigate={handleNavigate} />
            </MainLayout>
          }
        />

        {/* Contact */}
        <Route
          path="/contact"
          element={
            <MainLayout currentPage="contact" onNavigate={handleNavigate}>
              <Contact onNavigate={handleNavigate} />
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
      </Routes>
    </>
  );
}

/* App Wrapper */
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
