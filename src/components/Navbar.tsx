import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navbar = ({ currentPage, onNavigate }: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: 'home' },
    { name: 'Services', path: 'services' },
    { name: 'Portfolio', path: 'portfolio' },
    { name: 'About', path: 'about' },
    { name: 'Blog', path: 'blog' },
    { name: 'Contact', path: 'contact' },
  ];

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#003B5C]/80 backdrop-blur-md border-b border-[#2283B8]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => handleNavigate('home')}
          >
            <img
              src="/nobackgrounnd_blue_websitebuilder.png"
              alt="NextWave Digital Solutions"
              className="h-20 w-auto brightness-0 invert drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all"
            />
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`relative text-sm font-medium transition-colors ${
                  currentPage === item.path
                    ? 'text-[#2BB0E8]'
                    : 'text-white hover:text-[#2283B8]'
                }`}
              >
                {item.name}
                {currentPage === item.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#2BB0E8]"
                    style={{ boxShadow: '0 0 8px #2BB0E8' }}
                  />
                )}
              </button>
            ))}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigate('contact')}
              className="px-6 py-2 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#2283B8]/50 transition-shadow"
            >
              Get Started
            </motion.button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white p-2"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#003B5C]/95 backdrop-blur-lg border-b border-[#2283B8]/20"
          >
            <div className="px-4 py-6 space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    currentPage === item.path
                      ? 'text-[#2BB0E8] bg-[#2283B8]/10'
                      : 'text-white hover:bg-[#2283B8]/5'
                  }`}
                >
                  {item.name}
                </button>
              ))}
              <button
                onClick={() => handleNavigate('contact')}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-lg font-medium"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
