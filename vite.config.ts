import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'daymark-icon.svg', 'daymark-icon-192.png', 'daymark-icon-512.png'],
      manifest: {
        name: 'خُطوة — مساحة للمهام والتركيز',
        short_name: 'خُطوة',
        description: 'مساحة خاصة لتنظيم المهام والتخطيط والتركيز.',
        lang: 'ar',
        theme_color: '#0e0d0c',
        background_color: '#0e0d0c',
        display: 'standalone',
        icons: [
          { src: 'daymark-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'daymark-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'daymark-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
})
