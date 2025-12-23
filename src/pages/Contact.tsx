import { motion } from 'framer-motion';
import { ContactForm } from '../components/ContactForm';
import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

interface ContactProps {
  onNavigate: (page: string) => void;
}

export const Contact = ({ onNavigate }: ContactProps) => {
  const contactInfo = [
    {
      icon: MapPin,
      title: 'Location',
      info: 'Florida, United States',
    },
    {
      icon: Mail,
      title: 'Email',
      info: 'joshua@nextwavedigitalsolution.com',
    },
    {
      icon: Phone,
      title: 'Phone',
      info: '(321) 555-WAVE',
    },
    {
      icon: MessageSquare,
      title: 'Response Time',
      info: 'Within 24 hours',
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
            Contact NextWave Digital Solutions
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Let's talk about your project, goals, and how we can help you grow.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {contactInfo.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
              className="p-6 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-xl text-center hover:border-[#2BB0E8]/50 transition-all"
            >
              <div className="inline-flex p-4 bg-gradient-to-br from-[#2283B8]/20 to-[#2BB0E8]/20 rounded-xl mb-4">
                <item.icon size={28} className="text-[#2BB0E8]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-gray-300">{item.info}</p>
            </motion.div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <ContactForm />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 p-8 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-4">
            Prefer to explore first?
          </h2>
          <p className="text-gray-300 mb-6">
            Check out our services and portfolio to learn more about what we do
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('services')}
              className="px-6 py-3 bg-transparent border-2 border-[#2283B8] text-white rounded-lg font-medium hover:bg-[#2283B8]/10 transition-all"
            >
              View Services
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('portfolio')}
              className="px-6 py-3 bg-transparent border-2 border-[#2283B8] text-white rounded-lg font-medium hover:bg-[#2283B8]/10 transition-all"
            >
              View Portfolio
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
