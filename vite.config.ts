/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// BASE_PATH задаётся при публикации на GitHub Pages (например "/moy-den/").
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' — новая версия ставится только когда пользователь нажмёт «Обновить» в тосте,
      // чтобы страница не перезагрузилась посреди ввода.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Мой День',
        short_name: 'Мой День',
        description: 'Планнер, привычки, дневник побед и люди',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        background_color: '#FBF7F2',
        theme_color: '#FBF7F2',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
