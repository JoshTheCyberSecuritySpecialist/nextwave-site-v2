import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function CrmProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
        <p className="text-gray-300">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/crm/login" replace />;
  return <>{children}</>;
}
