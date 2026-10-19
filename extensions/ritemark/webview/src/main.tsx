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

// Lazy load the task board (Sprint 130, #119): the Tasks side bar and the Task
// board tab share one set of components and one host protocol.
const TasksPanel = lazy(() =>
  import('./components/tasks/TasksPanel').then((m) => ({ default: m.TasksPanel }))
)
const TaskBoard = lazy(() =>
  import('./components/tasks/TaskBoard').then((m) => ({ default: m.TaskBoard }))
)

// The welcome (Sprint 133): a window with no folder, the update welcome, the start sheet.
const WelcomePage = lazy(() =>
  import('./components/welcome/WelcomePage').then((m) => ({ default: m.WelcomePage }))
)

// Home and the projects list (Sprint 134): the project's own page, and the left column on Home.
const HomePage = lazy(() =>
  import('./components/home/HomePage').then((m) => ({ default: m.HomePage }))
)
const ProjectsList = lazy(() =>
  import('./components/home/ProjectsList').then((m) => ({ default: m.ProjectsList }))
)

// Check if this is a flow editor instance
const rootElement = document.getElementById('root')!
const editorType = rootElement.getAttribute('data-editor-type')

// Debug logging
console.log('[Ritemark] Initializing editor, type:', editorType)

watchRitemarkThemeClass()

// Sidebar panels use sideBar background (grey) instead of editor background (white). Ritemark Settings is a tab
// on the desk in 2.0 (experiences/settings frame 2; Jarmo, 17 October: "must have white bg"), so it keeps the desk's.
if (
  editorType === 'flows-panel' ||
  editorType === 'ai-sidebar' ||
  editorType === 'transcribe-panel' ||
  editorType === 'tasks-panel'
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
    ) : editorType === 'tasks-panel' ? (
      <Suspense fallback={<LoadingFallback />}>
        <TasksPanel />
      </Suspense>
    ) : editorType === 'task-board' ? (
      <Suspense fallback={<LoadingFallback />}>
        <TaskBoard />
      </Suspense>
    ) : editorType === 'welcome' ? (
      <Suspense fallback={null}>
        <WelcomePage />
      </Suspense>
    ) : editorType === 'home' ? (
      <Suspense fallback={null}>
        <HomePage />
      </Suspense>
    ) : editorType === 'projects' ? (
      <Suspense fallback={null}>
        <ProjectsList />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
