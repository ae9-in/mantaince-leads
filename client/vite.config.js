import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : [],
  },

  // ── Dev server with API proxy ─────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNRESET' || err.message.includes('socket hang up')) return;
            console.error('[Vite Proxy Error]:', err.message);
          });
          proxy.on('proxyReq', (_, req) => {
            if (req.headers.accept?.includes('text/event-stream')) {
              req.socket.setKeepAlive(true);
              req.socket.setNoDelay(true);
              req.socket.setTimeout(0);
            }
          });
        }
      }
    }
  },

  // ── Production build optimisations ────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,          // no source maps in production bundle
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Chunk splitting — vendor code cached separately from app code
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          ui:      ['lucide-react', 'react-hot-toast'],
          forms:   ['react-hook-form', '@hookform/resolvers', 'zod'],
          state:   ['zustand', 'axios'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
