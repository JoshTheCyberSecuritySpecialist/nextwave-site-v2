import { motion } from 'framer-motion';
import { CTASection } from '../components/CTASection';
import {
  Shield,
  Lock,
  Activity,
  FileCheck,
  HardDrive,
  UserCheck,
  Settings,
  CheckCircle,
} from 'lucide-react';

interface CybersecurityProps {
  onNavigate: (page: string) => void;
}

export const Cybersecurity = ({ onNavigate }: CybersecurityProps) => {
  const features = [
    { icon: Activity, text: 'Nessus / OpenVAS scanning' },
    { icon: Lock, text: 'Linux / Windows hardening' },
    { icon: UserCheck, text: 'IAM security' },
    { icon: Settings, text: 'Firewall & network setup' },
    { icon: Shield, text: 'ThreatLocker' },
    { icon: HardDrive, text: 'Intune / Jamf' },
    { icon: FileCheck, text: 'HIPAA compliance' },
    { icon: Settings, text: 'SecureSetup 365' },
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
            <Shield size={48} className="text-[#2BB0E8]" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Cybersecurity & IT
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Real protection for real businesses.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6">What We Provide</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                  className="flex items-center space-x-4 p-4 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-xl hover:border-[#2BB0E8]/50 transition-all"
                >
                  <div className="flex-shrink-0">
                    <feature.icon size={24} className="text-[#2BB0E8]" />
                  </div>
                  <span className="text-sm text-gray-300">{feature.text}</span>
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
              <h3 className="text-2xl font-bold text-white mb-4">Enterprise-Level Security</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Built on experience supporting NASA cybersecurity environments, we bring
                enterprise-grade security practices to businesses of all sizes.
              </p>
              <p className="text-gray-300 leading-relaxed">
                From vulnerability assessments to full system hardening, we implement
                comprehensive security solutions that protect your business from modern
                threats.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">Our Security Approach</h3>
              <ul className="space-y-3">
                {[
                  'Comprehensive vulnerability scanning',
                  'System hardening and configuration',
                  'Identity and access management',
                  'Network security and monitoring',
                  'Compliance support (HIPAA, etc.)',
                  'Incident response planning',
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
        title="Protect your business today"
        description="Don't wait for a breach to happen"
        buttonText="Secure My Business"
        onButtonClick={() => onNavigate('contact')}
      />
    </div>
  );
};
