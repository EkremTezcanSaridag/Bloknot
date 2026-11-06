import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages proje sayfası olarak da çalışsın diye göreli base kullanıyoruz.
// Böylece repo adı değişse bile asset yolları kırılmaz.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bloknot — Eğlenceli Not Defteri',
        short_name: 'Bloknot',
        description:
          'Blok tabanlı, eğlenceli ve tamamen tarayıcında çalışan kişisel not defterin.',
        lang: 'tr',
        dir: 'ltr',
        theme_color: '#7c5cff',
        background_color: '#faf8f4',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
