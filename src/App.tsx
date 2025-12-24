import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
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
import BlogAdmin from './pages/BlogAdmin';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const currentPage = location.pathname === '/' ? 'home' : location.pathname.slice(1).split('/')[0];

  const handleNavigate = (page: string) => {
    window.location.href = `/${page}`;
  };

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={
          <MainLayout currentPage="home" onNavigate={handleNavigate}>
            <Home onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/services" element={
          <MainLayout currentPage="services" onNavigate={handleNavigate}>
            <Services onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/web-development" element={
          <MainLayout currentPage="web-development" onNavigate={handleNavigate}>
            <WebDevelopment onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/cybersecurity" element={
          <MainLayout currentPage="cybersecurity" onNavigate={handleNavigate}>
            <Cybersecurity onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/automation-ai" element={
          <MainLayout currentPage="automation-ai" onNavigate={handleNavigate}>
            <AutomationAI onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/local-it-support" element={
          <MainLayout currentPage="local-it-support" onNavigate={handleNavigate}>
            <LocalITSupport onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/portfolio" element={
          <MainLayout currentPage="portfolio" onNavigate={handleNavigate}>
            <Portfolio onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/about" element={
          <MainLayout currentPage="about" onNavigate={handleNavigate}>
            <About onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/contact" element={
          <MainLayout currentPage="contact" onNavigate={handleNavigate}>
            <Contact onNavigate={handleNavigate} />
          </MainLayout>
        } />
        <Route path="/blog" element={
          <MainLayout currentPage="blog" onNavigate={handleNavigate}>
            <Blog />
          </MainLayout>
        } />
        <Route path="/blog/:slug" element={
          <MainLayout currentPage="blog" onNavigate={handleNavigate}>
            <BlogPost />
          </MainLayout>
        } />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/blog-admin" element={
          <ProtectedRoute>
            <BlogAdmin />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

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
