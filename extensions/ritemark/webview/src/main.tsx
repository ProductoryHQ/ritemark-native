import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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

// Check if this is a flow editor instance
const rootElement = document.getElementById('root')!
const editorType = rootElement.getAttribute('data-editor-type')

// Debug logging
console.log('[Ritemark] Initializing editor, type:', editorType)

// Sidebar panels use sideBar background (grey) instead of editor background (white)
if (editorType === 'flows-panel') {
  document.body.style.backgroundColor = 'var(--vscode-sideBar-background)'
}

// Loading fallback
const LoadingFallback = () => (
  <div
    style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-editor-foreground)',
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
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
