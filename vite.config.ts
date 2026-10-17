import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  base: '/', // 👈 REQUIRED for GitHub Pages with custom domain
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
