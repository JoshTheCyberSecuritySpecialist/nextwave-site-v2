import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

interface PortfolioCardProps {
  title: string;
  description: string;
  tags: string[];
  delay?: number;
}

export const PortfolioCard = ({ title, description, tags, delay = 0 }: PortfolioCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -8 }}
      className="relative group cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#2283B8]/30 to-[#2BB0E8]/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative h-full p-8 bg-[#001F33]/60 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl hover:border-[#2BB0E8]/60 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-2xl font-bold text-white">{title}</h3>
          <ExternalLink size={20} className="text-[#2BB0E8] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <p className="text-gray-300 mb-6 leading-relaxed">{description}</p>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 text-xs font-medium bg-[#2283B8]/20 text-[#2BB0E8] rounded-full border border-[#2283B8]/30"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
