import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { watchRitemarkThemeClass } from './utils/themeClass'

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

watchRitemarkThemeClass()

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
