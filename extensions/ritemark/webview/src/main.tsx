import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Lazy load FlowEditor to avoid loading React Flow for markdown files
const FlowEditor = lazy(() =>
  import('./components/flows/FlowEditor').then((m) => ({ default: m.FlowEditor }))
)

// Lazy load RiteMarkSettings
const RiteMarkSettings = lazy(() =>
  import('./components/settings/RiteMarkSettings').then((m) => ({ default: m.RiteMarkSettings }))
)

// Check if this is a flow editor instance
const rootElement = document.getElementById('root')!
const editorType = rootElement.getAttribute('data-editor-type')

// Debug logging
console.log('[RiteMark] Initializing editor, type:', editorType)

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
    Loading editor...
  </div>
)

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {editorType === 'settings' ? (
      <Suspense fallback={<LoadingFallback />}>
        <RiteMarkSettings />
      </Suspense>
    ) : editorType === 'flow' ? (
      <Suspense fallback={<LoadingFallback />}>
        <FlowEditor />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
