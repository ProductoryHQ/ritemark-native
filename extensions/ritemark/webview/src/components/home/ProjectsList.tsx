/**
 * The projects list (Sprint 134, R7, R13): the left column when Home is the
 * chosen place (experience 3, frame 1). Search all projects filters by name;
 * each project shows its mark, its name and what waits in it; the open one is
 * the column's white row; one whose folder is not found keeps its place,
 * muted, with Not found. A click switches in place, ⌥ click (Alt on Windows)
 * opens a new window. Add a project… offers Open a folder… and Start a new
 * project.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { ProjectRow, ProjectsMessage, ProjectsState } from '../../../../src/projects/protocol'
import { Button } from '../ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { sendProjects } from './homeClient'
import './home.css'

/** Rows whose name holds every word typed, in any case. */
export function filterProjects(projects: readonly ProjectRow[], query: string): ProjectRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...projects]
  return projects.filter((project) => {
    const name = project.name.toLowerCase()
    return words.every((word) => name.includes(word))
  })
}

function countWords(count: number): string {
  return count === 1 ? '1 waits' : `${count} wait`
}

function Row({ project, platform }: { project: ProjectRow; platform: ProjectsState['platform'] }) {
  const alt = platform === 'darwin' ? '⌥' : 'Alt'
  const open = (event: MouseEvent) => {
    sendProjects({ type: 'projects/open', id: project.id, newWindow: event.altKey })
  }
  const label = project.missing
    ? `${project.name}, not found. It was at ${project.place}`
    : `${project.name}${project.count ? `, ${countWords(project.count)}` : ''}${project.open ? ', open' : ''}`
  const tip = project.missing
    ? `Not found. It was at ${project.place}`
    : project.open ? `${project.place} (open)` : `${project.place}. ${alt} click opens it in a new window`
  const reveal = platform === 'win32' ? 'Reveal in File Explorer' : 'Reveal in Finder'
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          {/* Below the row, not to its right: the column is the webview's whole width (S38) */}
          <Tooltip label={tip} side="bottom" className="block">
            <button
              type="button"
              className={`rp-row${project.open ? ' open' : ''}${project.missing ? ' missing' : ''}`}
              aria-current={project.open ? 'true' : undefined}
              aria-label={label}
              onClick={open}
            >
              <span className="rp-mini" aria-hidden="true">{project.mark}</span>
              <span className="rp-name">{project.name}</span>
              {project.missing ? (
                <span className="rp-missing"><Icon name="warning-circle" size={12} tone="inherit" />Not found</span>
              ) : (
                project.count ? <span className="rp-count">{project.count > 99 ? '99+' : project.count}</span> : null
              )}
            </button>
          </Tooltip>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!project.open && <ContextMenuItem onSelect={() => sendProjects({ type: 'projects/open', id: project.id, newWindow: false })}>Open</ContextMenuItem>}
        {!project.missing && <ContextMenuItem onSelect={() => sendProjects({ type: 'projects/open', id: project.id, newWindow: true })}>Open in a new window</ContextMenuItem>}
        {!project.missing && <ContextMenuItem onSelect={() => sendProjects({ type: 'projects/reveal', id: project.id })}>{reveal}</ContextMenuItem>}
        {!project.open && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => sendProjects({ type: 'projects/remove', id: project.id })}>Remove from the list</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ProjectsListView({ state }: { state: ProjectsState }) {
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const shown = useMemo(() => filterProjects(state.projects, query), [state.projects, query])
  useEffect(() => {
    // File > Switch project and Home's "Search all projects" focus the search field.
    const onMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'projects/focus-search') search.current?.focus()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  return (
    <nav className="rp-column" aria-label="Projects">
      <label className="rp-search">
        <Icon name="magnifying-glass" size={14} tone="muted" />
        <input
          ref={search}
          type="search"
          placeholder="Search all projects"
          aria-label="Search all projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('')
          }}
        />
      </label>
      <h2 className="rp-label">Projects</h2>
      {shown.map((project) => <Row key={project.id} project={project} platform={state.platform} />)}
      {shown.length === 0 && query && <p className="rp-empty">No project’s name has “{query}”.</p>}
      <div className="rp-add">
        <DropdownMenu>
          <Tooltip label="Open a folder as a project, or start a new one" side="bottom" className="block">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rp-row justify-start">
                <Icon name="plus" size={14} tone="inherit" />Add a project…
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => sendProjects({ type: 'projects/open-folder' })}>Open a folder…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => sendProjects({ type: 'projects/new-project' })}>Start a new project</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}

export function ProjectsList() {
  const [state, setState] = useState<ProjectsState | null>(null)
  useEffect(() => {
    const onMessage = (event: MessageEvent<ProjectsMessage>) => {
      if (event.data?.type === 'projects/state') setState(event.data.state)
    }
    window.addEventListener('message', onMessage)
    sendProjects({ type: 'projects/ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])
  if (!state) return <nav className="rp-column" aria-busy="true" />
  return <ProjectsListView state={state} />
}
