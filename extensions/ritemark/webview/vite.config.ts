import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const enableSourceMaps = process.env.RITEMARK_WEBVIEW_SOURCEMAP === 'true'
const sourceMapPath = path.resolve(__dirname, '../media/webview.js.map')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ritemark-webview-sourcemap-cleanup',
      buildStart() {
        if (!enableSourceMaps && fs.existsSync(sourceMapPath)) {
          fs.unlinkSync(sourceMapPath)
        }
      },
    },
  ],
  build: {
    outDir: '../media',
    emptyOutDir: false,
    assetsInlineLimit: 50000, // Inline fonts as base64 (avoids webview URL access issues)
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.[ext]',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
    // External source maps trigger blocked fetch noise inside VS Code webview CSP.
    sourcemap: enableSourceMaps,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
