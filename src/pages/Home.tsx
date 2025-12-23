import { motion } from 'framer-motion';
import { Hero } from '../components/Hero';
import { ServiceCard } from '../components/ServiceCard';
import { FeatureCard } from '../components/FeatureCard';
import { PortfolioCard } from '../components/PortfolioCard';
import { CTASection } from '../components/CTASection';
import {
  Code,
  Shield,
  Zap,
  Server,
  Target,
  Rocket,
  Clock,
} from 'lucide-react';

interface HomeProps {
  onNavigate: (page: string) => void;
}

export const Home = ({ onNavigate }: HomeProps) => {
  return (
    <div>
      <Hero onNavigate={onNavigate} />

      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Our Services
            </h2>
            <p className="text-xl text-gray-300">
              Comprehensive digital solutions for modern businesses
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ServiceCard
              icon={Code}
              title="Web Development"
              description="High-converting, modern websites built with precision and speed."
              delay={0}
            />
            <ServiceCard
              icon={Shield}
              title="Cybersecurity & IT"
              description="Enterprise-level protection, system hardening, and compliance support."
              delay={0.1}
            />
            <ServiceCard
              icon={Zap}
              title="Automation & AI"
              description="AI agents, CRM workflows, Zapier automation, and smart business tools."
              delay={0.2}
            />
            <ServiceCard
              icon={Server}
              title="Local IT Support"
              description="Reliable IT infrastructure, networks, servers, backups, remote support."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      <section className="relative py-24 bg-gradient-to-b from-transparent via-[#2283B8]/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose Us
            </h2>
            <p className="text-xl text-gray-300">
              Built on discipline, innovation, and reliability
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureCard
              icon={Target}
              title="Precision Engineering"
              description="Built with the same discipline used in mission-critical systems."
              delay={0}
            />
            <FeatureCard
              icon={Rocket}
              title="Future-Ready"
              description="Solutions that scale with your business and technology evolution."
              delay={0.1}
            />
            <FeatureCard
              icon={Clock}
              title="Fast & Reliable Delivery"
              description="Clean processes, modern frameworks, and consistent communication."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Featured Projects
            </h2>
            <p className="text-xl text-gray-300">
              Real solutions for real businesses
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <PortfolioCard
              title="NexDay Plumbing"
              description="A high-converting plumbing site with instant-booking and clean layout."
              tags={['Web Design', 'Booking System', 'SEO']}
              delay={0}
            />
            <PortfolioCard
              title="TreeTek Florida"
              description="A rugged, premium tree service design with galleries + quote forms."
              tags={['Web Design', 'Gallery', 'Forms']}
              delay={0.1}
            />
            <PortfolioCard
              title="SecureSetup 365"
              description="A HIPAA-compliant Microsoft 365 hardening system with automation."
              tags={['Security', 'Compliance', 'Automation']}
              delay={0.2}
            />
            <PortfolioCard
              title="Launch Zone Charters"
              description="A tourism site combining rocket launches + charter bookings."
              tags={['Tourism', 'Booking', 'Web Design']}
              delay={0}
            />
            <PortfolioCard
              title="HireMate"
              description="A job automation platform powered by AI workflows."
              tags={['AI', 'Automation', 'Platform']}
              delay={0.1}
            />
            <PortfolioCard
              title="XRPay"
              description="A futuristic transaction UI for digital payments."
              tags={['Fintech', 'UI/UX', 'Crypto']}
              delay={0.2}
            />
          </div>

          <div className="text-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('portfolio')}
              className="inline-flex items-center px-8 py-4 bg-transparent border-2 border-[#2283B8] text-white rounded-xl font-semibold text-lg hover:bg-[#2283B8]/10 transition-all duration-300"
            >
              View All Projects
            </motion.button>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to build the next evolution of your business?"
        buttonText="Start Your Project"
        onButtonClick={() => onNavigate('contact')}
      />
    </div>
  );
};
