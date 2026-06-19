import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function gitBuildInfo(): { hash: string; date: string } {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
    }).trim()
    const date = execSync('git log -1 --format=%cI', {
      encoding: 'utf-8',
    }).trim()
    return { hash, date }
  } catch {
    return { hash: 'dev', date: new Date().toISOString() }
  }
}

const { hash: commitHash, date: commitDate } = gitBuildInfo()

export default defineConfig({
  define: {
    __APP_COMMIT_HASH__: JSON.stringify(commitHash),
    __APP_COMMIT_DATE__: JSON.stringify(commitDate),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Game Manager',
        short_name: 'GameManager',
        description: 'Gestion de collection de jeux vidéo',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
