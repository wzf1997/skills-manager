import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'archiver', 'gray-matter', 'electron-store']
            }
          }
        }
      },
      {
        entry: 'src/main/preload.ts',
        onstart(options) { options.reload() },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: { external: ['electron'] }
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
