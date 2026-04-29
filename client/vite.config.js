import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Cache static assets only — we deliberately do NOT prompt the user to install.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico'],
      manifest: false, // no install prompt
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Game state must always come from the server, never the SW cache.
        navigateFallback: null,
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
