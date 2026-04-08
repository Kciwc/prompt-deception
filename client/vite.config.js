import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // PWA-lite: precache assets only, NO install prompt
      manifest: {
        name: "Ceyon's Super Spiffy Trivia",
        short_name: 'Trivia',
        description: 'Non-Googleable AI Trivia Party Game',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'browser', // "browser" prevents install prompt
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/uploads': 'http://localhost:3001',
      '/admin': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
});
