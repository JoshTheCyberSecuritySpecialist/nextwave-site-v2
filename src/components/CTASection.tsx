import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface CTASectionProps {
  title: string;
  description?: string;
  buttonText: string;
  onButtonClick: () => void;
}

export const CTASection = ({ title, description, buttonText, onButtonClick }: CTASectionProps) => {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#2283B8]/10 to-[#2BB0E8]/10" />

      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(43, 176, 232, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(43, 176, 232, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {title}
          </h2>

          {description && (
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              {description}
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onButtonClick}
            className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-[#2283B8]/50 transition-all duration-300"
          >
            <span>{buttonText}</span>
            <ArrowRight size={20} />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};
