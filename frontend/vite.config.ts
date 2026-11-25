import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundle everything lazily imported so Vite never re-optimizes mid-session (duplicate React)
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@tanstack/react-query',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'zod',
      'gsap',
      'gsap/ScrollTrigger',
      'gsap/SplitText',
      '@gsap/react',
      'leaflet',
      'react-leaflet',
      'lucide-react',
      'msw',
      'msw/browser',
      'clsx',
    ],
  },
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          gsap: ['gsap', '@gsap/react'],
          leaflet: ['leaflet', 'react-leaflet'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
