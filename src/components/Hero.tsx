import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroProps {
  onNavigate: (page: string) => void;
}

export const Hero = ({ onNavigate }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2283B8]/5 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#2283B8]/10 border border-[#2283B8]/30 rounded-full mb-6"
            >
              <Sparkles size={16} className="text-[#2BB0E8]" />
              <span className="text-sm text-[#2BB0E8] font-medium">
                Engineering the Future
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Engineering the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2283B8] to-[#2BB0E8]">
                Future
              </span>{' '}
              of Digital Solutions.
            </h1>

            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Web Development • IT Infrastructure • Cybersecurity • Automation • AI
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('contact')}
                className="inline-flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-[#2283B8]/50 transition-all duration-300"
              >
                <span>Get Started</span>
                <ArrowRight size={20} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('services')}
                className="inline-flex items-center justify-center px-8 py-4 bg-transparent border-2 border-[#2283B8] text-white rounded-xl font-semibold text-lg hover:bg-[#2283B8]/10 transition-all duration-300"
              >
                Explore Services
              </motion.button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative">
              <motion.div
                animate={{
                  y: [0, -20, 0],
                  rotateY: [0, 5, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="relative z-10"
              >
                <div className="relative w-full aspect-square max-w-lg mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2283B8]/30 to-[#2BB0E8]/30 rounded-full blur-3xl" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-3/4 h-3/4 rounded-full bg-gradient-to-br from-[#2283B8]/20 to-[#2BB0E8]/20 backdrop-blur-sm border border-[#2283B8]/30 flex items-center justify-center">
                      <motion.img
                        animate={{
                          scale: [1, 1.05, 1],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        src="/nobackgrounnd_blue_websitebuilder.png"
                        alt="NextWave Digital Solutions"
                        className="w-64 h-auto object-contain drop-shadow-2xl"
                      />
                    </div>
                  </div>

                  <div className="absolute inset-0">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="w-full h-full"
                    >
                      <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#2BB0E8] rounded-full blur-sm" />
                      <div className="absolute bottom-0 right-1/3 w-2 h-2 bg-[#2283B8] rounded-full blur-sm" />
                      <div className="absolute top-1/3 right-0 w-2 h-2 bg-[#2BB0E8] rounded-full blur-sm" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              <div className="absolute inset-0 opacity-30">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(43, 176, 232, 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(43, 176, 232, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
