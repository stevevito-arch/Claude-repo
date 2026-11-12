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
      // Precache the registry catalog too, so the installed app can browse it offline.
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,json}'] },
      manifest: {
        name: 'ALS Clinical Trials Dashboard',
        short_name: 'ALS Trials',
        description: 'Tracking ongoing ALS clinical trials: modality, preclinical evidence, phase, results, and estimated timeframes.',
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
