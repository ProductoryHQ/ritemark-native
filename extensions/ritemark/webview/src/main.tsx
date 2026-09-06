import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!match) return null

  const normalized = match[1].length === 3
    ? match[1].split('').map((char) => char + char).join('')
    : match[1]

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ]
}

function isDarkColor(value: string): boolean {
  const rgb = parseHexColor(value)
  if (!rgb) return false

  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 0.18
}

function syncRitemarkThemeClass() {
  const body = document.body
  const classList = body.classList
  const themeKind = body.getAttribute('data-vscode-theme-kind') ?? ''
  const editorBackground = getComputedStyle(body).getPropertyValue('--vscode-editor-background')
  const shouldUseDarkTokens =
    classList.contains('vscode-dark') ||
    themeKind.toLowerCase().includes('dark') ||
    isDarkColor(editorBackground)

  classList.toggle('ritemark-dark', shouldUseDarkTokens)
}

// Lazy load FlowEditor to avoid loading React Flow for markdown files
const FlowEditor = lazy(() =>
  import('./components/flows/FlowEditor').then((m) => ({ default: m.FlowEditor }))
)

// Lazy load FlowsPanel for sidebar
const FlowsPanel = lazy(() =>
  import('./components/flows/FlowsPanel').then((m) => ({ default: m.FlowsPanel }))
)

// Lazy load RitemarkSettings
const RitemarkSettings = lazy(() =>
  import('./components/settings/RitemarkSettings').then((m) => ({ default: m.RitemarkSettings }))
)

// Lazy load AISidebar
const AISidebar = lazy(() =>
  import('./components/ai-sidebar/AISidebar').then((m) => ({ default: m.AISidebar }))
)

// Lazy load the Transcribe panel (Sprint 108) — the sidebar app for turning
// recordings into markdown. Lazy like every other surface, so it stays off the
// critical path for plain markdown editing (#107).
const TranscribePanel = lazy(() =>
  import('./components/transcribe/TranscribePanel').then((m) => ({ default: m.TranscribePanel }))
)

// Lazy load the Transcript Workbench (Sprint 108) — the editor surface for a
// recording: waveform, speaker-separated transcript, click-a-line-to-hear-it.
const TranscriptWorkbench = lazy(() =>
  import('./components/transcribe/workbench/Workbench').then((m) => ({ default: m.Workbench }))
)

// Check if this is a flow editor instance
const rootElement = document.getElementById('root')!
const editorType = rootElement.getAttribute('data-editor-type')

// Debug logging
console.log('[Ritemark] Initializing editor, type:', editorType)

syncRitemarkThemeClass()
new MutationObserver(syncRitemarkThemeClass).observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'data-vscode-theme-kind', 'style'],
})

// Sidebar panels use sideBar background (grey) instead of editor background (white)
if (
  editorType === 'flows-panel' ||
  editorType === 'ai-sidebar' ||
  editorType === 'settings' ||
  editorType === 'transcribe-panel'
) {
  document.body.style.backgroundColor = 'var(--r-surface-muted)'
}

// Loading fallback
const LoadingFallback = () => (
  <div
    style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--background)',
      color: 'var(--foreground)',
    }}
  >
    Loading...
  </div>
)

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {editorType === 'settings' ? (
      <Suspense fallback={<LoadingFallback />}>
        <RitemarkSettings />
      </Suspense>
    ) : editorType === 'flow' ? (
      <Suspense fallback={<LoadingFallback />}>
        <FlowEditor />
      </Suspense>
    ) : editorType === 'flows-panel' ? (
      <Suspense fallback={<LoadingFallback />}>
        <FlowsPanel />
      </Suspense>
    ) : editorType === 'ai-sidebar' ? (
      <Suspense fallback={<LoadingFallback />}>
        <AISidebar />
      </Suspense>
    ) : editorType === 'transcribe-panel' ? (
      <Suspense fallback={<LoadingFallback />}>
        <TranscribePanel />
      </Suspense>
    ) : editorType === 'transcript-workbench' ? (
      <Suspense fallback={<LoadingFallback />}>
        <TranscriptWorkbench />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
