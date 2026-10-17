import { Mail, Phone, MapPin, Linkedin, Twitter, Github } from 'lucide-react';
import { bookingPackage, websiteCrmPackage } from '../data/offers';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer = ({ onNavigate }: FooterProps) => {
  const handleNavigate = (path: string) => {
    onNavigate(path);
    if (!path.includes('#')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="relative bg-[#003B5C] border-t border-[#2283B8]/20 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="min-w-0 space-y-4">
            <img
              src="/nobackgrounnd_blue_websitebuilder.png"
              alt="NextWave Digital Solutions"
              className="h-14 w-auto brightness-0 invert opacity-80"
            />
            <p className="text-gray-300 text-sm">
              Booking systems, websites, and customer relationship management for local businesses.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-gray-400 hover:text-[#2BB0E8] transition-colors"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-[#2BB0E8] transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-[#2BB0E8] transition-colors"
              >
                <Github size={20} />
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-white font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('/#packages')}
                  className="text-gray-300 hover:text-[#2BB0E8] transition-colors text-sm text-left"
                >
                  {bookingPackage.name} — {bookingPackage.priceDisplay}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('/#packages')}
                  className="text-gray-300 hover:text-[#2BB0E8] transition-colors text-sm text-left"
                >
                  {websiteCrmPackage.name} — {websiteCrmPackage.priceDisplay}
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('web-development')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm text-left"
                >
                  Web Development
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('cybersecurity')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  Cybersecurity
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('automation-ai')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  Automation
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('local-it-support')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  Local IT Support
                </button>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => handleNavigate('about')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('portfolio')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  Portfolio
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('blog')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  Blog
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('contact')}
                  className="text-gray-400 hover:text-[#2BB0E8] transition-colors text-sm"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex min-w-0 items-start space-x-2 text-gray-400 text-sm">
                <MapPin size={16} className="mt-1 flex-shrink-0 text-[#2BB0E8]" />
                <span>Florida, United States</span>
              </li>
              <li className="flex min-w-0 items-start space-x-2 text-gray-400 text-sm">
                <Mail size={16} className="mt-1 flex-shrink-0 text-[#2BB0E8]" />
                <a href="mailto:joshua@nextwavedigitalsolution.com" className="min-w-0 break-all hover:text-[#2BB0E8]">
                  joshua@nextwavedigitalsolution.com
                </a>
              </li>
              <li className="flex min-w-0 items-start space-x-2 text-gray-400 text-sm">
                <Phone size={16} className="mt-1 flex-shrink-0 text-[#2BB0E8]" />
                <span>(321) 555-WAVE</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#2283B8]/20 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} NextWave Digital Solutions. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
