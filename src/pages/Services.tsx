import { motion } from 'framer-motion';
import { ServiceCard } from '../components/ServiceCard';
import { CTASection } from '../components/CTASection';
import { Code, Shield, Zap, Server } from 'lucide-react';

interface ServicesProps {
  onNavigate: (page: string) => void;
}

export const Services = ({ onNavigate }: ServicesProps) => {
  return (
    <div className="pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Our Services
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Comprehensive digital solutions engineered for modern businesses
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          <div onClick={() => onNavigate('web-development')} className="cursor-pointer">
            <ServiceCard
              icon={Code}
              title="Web Development"
              description="High-converting, modern websites built with precision and speed."
              delay={0}
            />
          </div>
          <div onClick={() => onNavigate('cybersecurity')} className="cursor-pointer">
            <ServiceCard
              icon={Shield}
              title="Cybersecurity & IT"
              description="Enterprise-level protection, system hardening, and compliance support."
              delay={0.1}
            />
          </div>
          <div onClick={() => onNavigate('automation-ai')} className="cursor-pointer">
            <ServiceCard
              icon={Zap}
              title="Automation & AI"
              description="AI agents, CRM workflows, Zapier automation, and smart business tools."
              delay={0.2}
            />
          </div>
          <div onClick={() => onNavigate('local-it-support')} className="cursor-pointer">
            <ServiceCard
              icon={Server}
              title="Local IT Support"
              description="Reliable IT infrastructure, networks, servers, backups, remote support."
              delay={0.3}
            />
          </div>
        </div>
      </div>

      <CTASection
        title="Ready to transform your business?"
        buttonText="Get Started Today"
        onButtonClick={() => onNavigate('contact')}
      />
    </div>
  );
};
