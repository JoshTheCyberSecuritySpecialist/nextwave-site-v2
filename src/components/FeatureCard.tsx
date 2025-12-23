import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
}

export const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="text-center"
    >
      <div className="inline-flex p-4 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 rounded-2xl mb-4 border border-[#2283B8]/20">
        <Icon size={40} className="text-[#2BB0E8]" />
      </div>

      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>

      <p className="text-gray-300 leading-relaxed">{description}</p>
    </motion.div>
  );
};
