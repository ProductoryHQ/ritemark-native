import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const enableSourceMaps = process.env.RITEMARK_WEBVIEW_SOURCEMAP === 'true'

// Two bundles from one source tree (Sprint 124 R3):
//   vite build               -> media/webview.js        every editor and panel
//   vite build --mode office -> media/office-preview.js the Office previews (Word, PowerPoint)
//                               and office-preview.NOTICES.txt, its third-party notices
// Keeping the Office renderers out of webview.js keeps them off every other
// view, and a Word tab loads ~1 MB instead of the whole editor bundle.
const BUNDLES = {
  webview: { input: 'src/main.tsx', name: 'webview' },
  office: { input: 'src/office/main.tsx', name: 'office-preview' },
} as const

const LICENSE_FILE = /^(licen[cs]e|copying|notice|third[-_]party[-_]notices)(\.|$)/i

/** The package folder a bundled module belongs to: the last `node_modules/<name>` in its path. */
function packageDirOf(id: string): string | null {
  const file = id.split('?')[0]
  const marker = `${path.sep}node_modules${path.sep}`
  const at = file.lastIndexOf(marker)
  if (at < 0) return null
  const rest = file.slice(at + marker.length).split(path.sep)
  const nameParts = rest[0].startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1)
  return file.slice(0, at + marker.length) + nameParts.join(path.sep)
}

/**
 * Sprint 125 (#285): the Office bundle carries third-party code whose licences
 * ask for their notices to travel with it — ECharts' Apache-2.0 NOTICE, and the
 * MPL-2.0 font decompressor inside the PowerPoint renderer (listed in the
 * renderer's own third-party notices). Written from what the bundle actually
 * contains, sorted, so it cannot drift and a rebuild does not change it.
 */
function thirdPartyNotices(outFile: string) {
  return {
    name: 'ritemark-third-party-notices',
    generateBundle(this: { getModuleIds(): IterableIterator<string> }) {
      const dirs = new Set<string>()
      for (const id of this.getModuleIds()) {
        const dir = packageDirOf(id)
        if (dir && fs.existsSync(path.join(dir, 'package.json'))) dirs.add(dir)
      }
      // One section per package and version: nested copies of the same release are one entry.
      const byRelease = new Map<string, { name: string; text: string }>()
      for (const dir of dirs) {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
        const release = `${pkg.name} ${pkg.version}`
        if (byRelease.has(release)) continue
        const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'see below'
        const texts = fs
          .readdirSync(dir)
          .filter((name) => LICENSE_FILE.test(name))
          .sort()
          .map((name) => fs.readFileSync(path.join(dir, name), 'utf8').trim())
        byRelease.set(release, { name: release, text: [`${release} (${license})`, ...texts].join('\n\n') })
      }
      const sections = [...byRelease.values()].sort((a, b) => a.name.localeCompare(b.name))
      const header = 'Third-party software in office-preview.js, the Ritemark Office preview (Word, PowerPoint).\nGenerated at build time from the packages the bundle contains.'
      fs.writeFileSync(outFile, `${[header, ...sections.map((s) => s.text)].join(`\n\n${'='.repeat(78)}\n\n`)}\n`)
    },
  }
}

/**
 * Sprint 138 (#481, R13): KaTeX's stylesheet and fonts as files in
 * `media/katex/`, loaded by the editor only when a document has math.
 * Inlined, they would add 400 KB (woff2 alone) to 1.5 MB (through this
 * config's font inlining) to every view (#107), so they are never imported.
 *
 * Copied from the one KaTeX the bundle holds: the build fails if the module
 * graph has two copies of `katex`, or one at another version than the pinned
 * dependency, since the stylesheet must match the code that typesets.
 */
function katexAssets(outDir: string) {
  return {
    name: 'ritemark-katex-assets',
    generateBundle(this: { getModuleIds(): IterableIterator<string>; error(message: string): never }) {
      const versions = new Map<string, string>()
      for (const id of this.getModuleIds()) {
        const dir = packageDirOf(id)
        if (!dir || path.basename(dir) !== 'katex') continue
        versions.set(dir, JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version)
      }
      const pinned = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).dependencies.katex
      if (versions.size !== 1) {
        this.error(`webview.js must hold exactly one KaTeX; found ${versions.size}: ${[...versions].map(([dir, v]) => `${v} at ${dir}`).join(', ')}`)
      }
      const [[katexDir, version]] = [...versions]
      if (version !== pinned) {
        this.error(`webview.js holds KaTeX ${version}, but package.json pins ${pinned}; media/katex/ must match the code`)
      }

      const dist = path.join(katexDir, 'dist')
      const target = path.join(outDir, 'katex')
      fs.mkdirSync(path.join(target, 'fonts'), { recursive: true })
      // Each @font-face names only its woff2 file, so nothing else is ever requested.
      const css = fs.readFileSync(path.join(dist, 'katex.min.css'), 'utf8')
        .replace(/src:url\((fonts\/[^)]+\.woff2)\) format\("woff2"\)(?:,url\([^)]+\) format\("[^"]+"\))*/g, 'src:url($1) format("woff2")')
      if (/\.(woff|ttf)\)/.test(css)) this.error('katex.min.css still names a font that is not woff2')
      fs.writeFileSync(path.join(target, 'katex.min.css'), css)
      const faces = fs.readdirSync(path.join(dist, 'fonts')).filter(name => name.endsWith('.woff2')).sort()
      for (const face of faces) fs.copyFileSync(path.join(dist, 'fonts', face), path.join(target, 'fonts', face))
      for (const name of fs.readdirSync(path.join(target, 'fonts'))) {
        if (!faces.includes(name)) fs.unlinkSync(path.join(target, 'fonts', name))
      }
      fs.copyFileSync(path.join(katexDir, 'LICENSE'), path.join(target, 'LICENSE'))
      fs.writeFileSync(path.join(target, 'VERSION'), `${version}\n`)
    },
  }
}

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
      ...(mode === 'office' ? [thirdPartyNotices(path.resolve(__dirname, '../media/office-preview.NOTICES.txt'))] : []),
      ...(mode === 'office' ? [] : [katexAssets(path.resolve(__dirname, '../media'))]),
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
