import { motion } from 'framer-motion';
import { CTASection } from '../components/CTASection';
import { Target, Shield, Lightbulb, TrendingUp } from 'lucide-react';

interface AboutProps {
  onNavigate: (page: string) => void;
}

export const About = ({ onNavigate }: AboutProps) => {
  const values = [
    {
      icon: Shield,
      title: 'Security',
      description: 'Protection and reliability in everything we build',
    },
    {
      icon: Lightbulb,
      title: 'Innovation',
      description: 'Cutting-edge solutions for modern challenges',
    },
    {
      icon: Target,
      title: 'Precision',
      description: 'Attention to detail and quality craftsmanship',
    },
    {
      icon: TrendingUp,
      title: 'Growth',
      description: 'Solutions that scale with your business',
    },
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
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            About NextWave Digital Solutions
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Engineering modern digital systems with precision, security, and innovation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="space-y-8"
          >
            <div className="p-8 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
              <p className="text-gray-300 leading-relaxed text-lg">
                To create secure, scalable, intelligent digital solutions for businesses that want to
                stay ahead in an evolving technological landscape.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl">
              <h2 className="text-3xl font-bold text-white mb-4">Founder Background</h2>
              <p className="text-gray-300 leading-relaxed text-lg mb-4">
                NextWave Digital Solutions is built on real experience supporting NASA
                cybersecurity environments and enterprise IT systems.
              </p>
              <p className="text-gray-300 leading-relaxed text-lg">
                We bring the same level of precision, security, and attention to detail
                from mission-critical systems to businesses of all sizes.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-white mb-8">Our Values</h2>
            <div className="space-y-6">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                  className="flex items-start space-x-4 p-6 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-xl hover:border-[#2BB0E8]/50 transition-all"
                >
                  <div className="flex-shrink-0 p-3 bg-gradient-to-br from-[#2283B8]/20 to-[#2BB0E8]/20 rounded-lg">
                    <value.icon size={28} className="text-[#2BB0E8]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{value.title}</h3>
                    <p className="text-gray-300 leading-relaxed">{value.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center p-12 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-3xl"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Let's build the future of your business — together.
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            We're here to help you navigate the digital landscape with confidence.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('contact')}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-[#2283B8]/50 transition-all duration-300"
          >
            Get Started Today
          </motion.button>
        </motion.div>
      </div>

      <div className="mt-24">
        <CTASection
          title="Ready to transform your business?"
          buttonText="Contact Us"
          onButtonClick={() => onNavigate('contact')}
        />
      </div>
    </div>
  );
};
