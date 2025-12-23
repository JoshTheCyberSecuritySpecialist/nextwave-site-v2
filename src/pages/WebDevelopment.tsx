import { motion } from 'framer-motion';
import { CTASection } from '../components/CTASection';
import {
  Code,
  Search,
  Sparkles,
  Layout,
  Palette,
  Calendar,
  Zap,
  CheckCircle,
} from 'lucide-react';

interface WebDevelopmentProps {
  onNavigate: (page: string) => void;
}

export const WebDevelopment = ({ onNavigate }: WebDevelopmentProps) => {
  const features = [
    { icon: Code, text: 'Custom React/Tailwind builds' },
    { icon: Search, text: 'SEO optimization' },
    { icon: Sparkles, text: 'AI-enhanced tools' },
    { icon: Layout, text: 'Local business sites' },
    { icon: Palette, text: 'UI/UX + branding' },
    { icon: Calendar, text: 'Booking + forms' },
    { icon: Zap, text: 'Fast hosting setups' },
  ];

  return (
    <div className="pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex p-4 bg-gradient-to-br from-[#2283B8]/20 to-[#2BB0E8]/20 rounded-xl mb-6">
            <Code size={48} className="text-[#2BB0E8]" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Web Development
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            High-performance websites engineered for speed, SEO, and conversions.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6">What We Deliver</h2>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                  className="flex items-center space-x-4 p-4 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-xl hover:border-[#2BB0E8]/50 transition-all"
                >
                  <div className="flex-shrink-0">
                    <feature.icon size={24} className="text-[#2BB0E8]" />
                  </div>
                  <span className="text-lg text-gray-300">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="space-y-8"
          >
            <div className="p-8 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">Our Approach</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                We build modern, high-performance websites using cutting-edge technologies
                like React, Next.js, and Tailwind CSS. Every site is optimized for speed,
                search engines, and conversions.
              </p>
              <p className="text-gray-300 leading-relaxed">
                From local business sites to complex web applications, we deliver solutions
                that look great, perform flawlessly, and drive real business results.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">Why Choose Us</h3>
              <ul className="space-y-3">
                {[
                  'Lightning-fast load times',
                  'Mobile-first responsive design',
                  'SEO-optimized from day one',
                  'Modern, conversion-focused design',
                  'Easy content management',
                  'Ongoing support and maintenance',
                ].map((item, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle size={20} className="text-[#2BB0E8] flex-shrink-0" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>

      <CTASection
        title="Ready to build your dream website?"
        description="Let's create something amazing together"
        buttonText="Request Web Development"
        onButtonClick={() => onNavigate('contact')}
      />
    </div>
  );
};
