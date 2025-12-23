import { motion } from 'framer-motion';
import { CTASection } from '../components/CTASection';
import {
  Server,
  Network,
  HardDrive,
  Headphones,
  Mail,
  Cloud,
  CheckCircle,
} from 'lucide-react';

interface LocalITSupportProps {
  onNavigate: (page: string) => void;
}

export const LocalITSupport = ({ onNavigate }: LocalITSupportProps) => {
  const features = [
    { icon: Server, text: 'Servers' },
    { icon: Network, text: 'Networks' },
    { icon: HardDrive, text: 'Backup & disaster recovery' },
    { icon: Headphones, text: 'Remote support' },
    { icon: Mail, text: 'Email & M365 configuration' },
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
            <Server size={48} className="text-[#2BB0E8]" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Local IT Support
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Reliable support for Florida small businesses.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6">What We Support</h2>
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

            <div className="mt-8 p-6 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <div className="flex items-center space-x-3 mb-3">
                <Cloud size={24} className="text-[#2BB0E8]" />
                <h3 className="text-xl font-bold text-white">Serving Florida</h3>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Based in Florida, we provide reliable on-site and remote IT support
                for local businesses throughout the region.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="space-y-8"
          >
            <div className="p-8 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">Reliable IT Infrastructure</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Your business depends on technology that works. We provide comprehensive
                IT support to keep your systems running smoothly, from servers and networks
                to email and cloud services.
              </p>
              <p className="text-gray-300 leading-relaxed">
                Whether you need on-site support or remote assistance, we're here to help
                your business stay productive and secure.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">Why Choose Us</h3>
              <ul className="space-y-3">
                {[
                  'Fast response times',
                  'Expert technical support',
                  'Proactive maintenance',
                  'Comprehensive backup solutions',
                  'Microsoft 365 specialists',
                  'Reliable disaster recovery',
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
        title="Need reliable IT support?"
        description="Let's keep your business running smoothly"
        buttonText="Get IT Support"
        onButtonClick={() => onNavigate('contact')}
      />
    </div>
  );
};
