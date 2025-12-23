import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const BackgroundMatrix = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      speed: number;
      char: string;
      opacity: number;
    }> = [];

    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 0.5 + Math.random() * 1,
        char: chars[Math.floor(Math.random() * chars.length)],
        opacity: 0.1 + Math.random() * 0.2,
      });
    }

    let animationFrameId: number;

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 59, 92, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        ctx.fillStyle = `rgba(43, 176, 232, ${particle.opacity})`;
        ctx.font = '14px monospace';
        ctx.fillText(particle.char, particle.x, particle.y);

        particle.y += particle.speed;

        if (particle.y > canvas.height) {
          particle.y = 0;
          particle.x = Math.random() * canvas.width;
        }

        if (Math.random() > 0.98) {
          particle.char = chars[Math.floor(Math.random() * chars.length)];
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #003B5C 0%, #002040 100%)' }}
      />

      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(43, 176, 232, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(43, 176, 232, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }} />
      </div>

      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(34, 131, 184, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(43, 176, 232, 0.1) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, -100, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};
