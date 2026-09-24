import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const enableSourceMaps = process.env.RITEMARK_WEBVIEW_SOURCEMAP === 'true'

// Two bundles from one source tree (Sprint 124 R3):
//   vite build               -> media/webview.js        every editor and panel
//   vite build --mode office -> media/office-preview.js the Office previews (Word)
// Keeping the Office renderers out of webview.js keeps them off every other
// view, and a Word tab loads ~1 MB instead of the whole editor bundle.
const BUNDLES = {
  webview: { input: 'src/main.tsx', name: 'webview' },
  office: { input: 'src/office/main.tsx', name: 'office-preview' },
} as const

export default defineConfig(({ mode }) => {
  const bundle = mode === 'office' ? BUNDLES.office : BUNDLES.webview
  const sourceMapPath = path.resolve(__dirname, `../media/${bundle.name}.js.map`)

  return {
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
        input: bundle.input,
        output: {
          entryFileNames: `${bundle.name}.js`,
          assetFileNames: `${bundle.name}.[ext]`,
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
  }
})
