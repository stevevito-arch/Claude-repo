import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo from /Claude-repo/, not the domain root.
const REPO_BASE = '/Claude-repo/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}', 'manifest.webmanifest'],
        // The registry catalogs (one per disease, up to several MB) are cached
        // when first opened rather than precached, so installing the app doesn't
        // download every disease. The network is tried first so a new deploy's
        // data shows up; the cached copy serves offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('-registry.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'registry-catalogs', networkTimeoutSeconds: 6, expiration: { maxEntries: 8 } },
          },
        ],
      },
      manifest: {
        name: "ALS and Parkinson's Clinical Trials Dashboard",
        short_name: 'Trials Dashboard',
        description: "Every registered ALS and Parkinson's disease study: therapy target, modality, phase, outcome and development timeline.",
        display: 'standalone',
        background_color: '#0d0d0d',
        theme_color: '#2a78d6',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}))
