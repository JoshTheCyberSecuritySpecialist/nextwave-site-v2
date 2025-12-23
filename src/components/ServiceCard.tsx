import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
}

export const ServiceCard = ({ icon: Icon, title, description, delay = 0 }: ServiceCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -8 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#2283B8]/20 to-[#2BB0E8]/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative h-full p-8 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl hover:border-[#2BB0E8]/50 transition-all duration-300">
        <div className="mb-6 inline-flex p-4 bg-gradient-to-br from-[#2283B8]/20 to-[#2BB0E8]/20 rounded-xl">
          <Icon size={32} className="text-[#2BB0E8]" />
        </div>

        <h3 className="text-2xl font-bold text-white mb-4">{title}</h3>

        <p className="text-gray-300 leading-relaxed">{description}</p>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-b-2xl" />
      </div>
    </motion.div>
  );
};
