import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText, LogOut, User, Layout, Users } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    {
      title: 'Blog Management',
      description: 'Create and manage blog posts',
      icon: FileText,
      path: '/blog-admin',
      color: 'bg-[#2283B8]',
    },
    {
      title: 'Subscribers',
      description: 'View and manage email subscribers',
      icon: Users,
      path: '/admin/subscribers',
      color: 'bg-[#2283B8]',
      disabled: true,
    },
    {
      title: 'Public Website',
      description: 'View your public website',
      icon: Layout,
      path: '/',
      color: 'bg-[#2283B8]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      <nav className="bg-[#0d1424] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src="/nextwave_smoothblue.png"
                alt="NextWave"
                className="h-8"
              />
              <span className="text-white font-semibold text-lg">Admin Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-[#0A0F1E] rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back, Admin</h1>
          <p className="text-gray-400">Manage your website content and settings from here</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => !item.disabled && navigate(item.path)}
                disabled={item.disabled}
                className={`bg-[#0d1424] border border-gray-800 rounded-xl p-6 transition-all text-left group ${
                  item.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-[#2283B8] hover:shadow-lg hover:shadow-[#2283B8]/10'
                }`}
              >
                <div className={`${item.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${!item.disabled && 'group-hover:scale-110'} transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {item.title}
                  {item.disabled && (
                    <span className="ml-2 text-xs text-gray-500">(Coming Soon)</span>
                  )}
                </h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-12 bg-[#0d1424] border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-xl mb-4">Quick Stats</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Account Status</p>
              <p className="text-white font-semibold">Active</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Email</p>
              <p className="text-white font-semibold break-all">{user?.email}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Role</p>
              <p className="text-white font-semibold">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
