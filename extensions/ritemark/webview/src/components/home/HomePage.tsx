/**
 * Home (Sprint 134, R4, R11, R13): the project's own page, first tab on the desk.
 * - the cover (Ritemark's picture, or the project's own) with Change image;
 * - the project's mark and name, the folder it works in (opens Documents), its line;
 * - What moved, once, on a profile updated from Ritemark 1 (experience 32, frame 5);
 * - Waiting for you, with what waits in the other projects;
 * - Start something in <project>: Text, Table, Web page;
 * - Last changed in <project>; an empty project's drop target (experience 29, frame 1);
 * - a project of the list whose folder is not found (experience 33, frame 2).
 *
 * The host owns the state (`src/views/HomePanel.ts`); this page draws it and
 * sends what the person does. Every name is drawn as text, never as markup.
 */

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { HomeMessage, HomeState } from '../../../../src/projects/protocol'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { othersWords, recentIcon, waitingIcon, waitingWords, whenWords } from './homeWords'
import { send } from './homeClient'
import './home.css'

function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function ProjectLine({ line }: { line: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(line)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!editing) setDraft(line)
  }, [line, editing])
  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])
  const save = () => {
    setEditing(false)
    if (draft.trim() !== line) send({ type: 'home/set-line', line: draft })
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') save()
    if (event.key === 'Escape') {
      setDraft(line)
      setEditing(false)
    }
  }
  if (editing) {
    return (
      <input
        ref={input}
        className="rh-line-input"
        value={draft}
        maxLength={200}
        aria-label="A line about this project"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={onKey}
      />
    )
  }
  return (
    <button type="button" className={`rh-line${line ? '' : ' empty'}`} onClick={() => setEditing(true)} aria-label={line ? `${line}. Edit the line about this project` : 'Add a line about this project'}>
      {line || 'Add a line about this project'}
    </button>
  )
}

function Head({ state }: { state: HomeState }) {
  const { project } = state
  return (
    <>
      <span className="rh-mark" aria-hidden="true">{project.mark}</span>
      <h1 className="rh-name">{project.name}</h1>
      {/* A block, not the tooltip's inline-flex: as a flex item the button came out a few pixels short of its text. */}
      <Tooltip label="Show its files in Documents" side="bottom" className="block max-w-full">
        <Button variant="ghost" className="rh-place max-w-full justify-start" onClick={() => send({ type: 'home/open-documents' })} aria-label={`${project.place}. Show its files in Documents`}>
          <Icon name="folder-simple" size={14} tone="inherit" />
          <span className="rh-place-text">{project.place}</span>
          <Icon name="caret-right" size={12} tone="muted" />
        </Button>
      </Tooltip>
      <ProjectLine line={project.line} />
    </>
  )
}

function WhatMoved() {
  return (
    <section className="rh-card" aria-label="What moved in Ritemark 2.0">
      <div className="rh-card-head">
        <span className="rh-version">2.0</span>
        What moved
        <Tooltip label="Close this, for good" className="rh-card-action">
          <Button variant="outline" size="sm" onClick={() => send({ type: 'home/what-moved-seen' })}>Got it</Button>
        </Tooltip>
      </div>
      <div className="rh-moved"><span className="rh-ic"><Icon name="terminal" size={12} tone="inherit" /></span><span><b>The terminal is a tab.</b> Yours sits beside your documents; a new one comes from the +.</span></div>
      <div className="rh-moved"><span className="rh-ic"><Icon name="dots-three" size={12} tone="inherit" /></span><span><b>Copilot Chat is in More,</b> at the end of the places on the left, and opens as a tab.</span></div>
      <div className="rh-moved"><span className="rh-ic"><Icon name="user" size={12} tone="inherit" /></span><span><b>Settings and Help are under you,</b> at the top right; {navigator.platform.startsWith('Win') ? 'Ctrl+,' : '⌘,'} opens Settings.</span></div>
    </section>
  )
}

function Waiting({ state, now }: { state: HomeState; now: number }) {
  const { waiting } = state
  const others = othersWords(state.others, waiting.items.length)
  return (
    <section aria-label="Waiting for you">
      <h2 className="rh-h3">
        Waiting for you
        {waiting.count !== null && waiting.count > 0 && <span className="rh-badge" aria-label={`${waiting.count} ${waiting.count === 1 ? 'thing waits' : 'things wait'}`}>{waiting.count > 99 ? '99+' : waiting.count}</span>}
      </h2>
      {waiting.items.map((item) => {
        const words = waitingWords(item)
        return (
          <button key={item.id} type="button" className="rh-row" onClick={() => send({ type: 'home/open-waiting', id: item.id })}>
            <span className="rh-ic"><Icon name={waitingIcon(item)} size={14} tone="inherit" /></span>
            <span className="rh-text">{words.text}</span>
            {words.tag && <span className="rh-tag">{words.tag}</span>}
            <span className="rh-when">{whenWords(item.since, now, 'minutes')}</span>
          </button>
        )
      })}
      {waiting.items.length === 0 && !others && <p className="rh-sub">{waiting.count === null ? 'Ritemark can’t tell what waits right now.' : 'Nothing waits for you.'}</p>}
      {others && <p className="rh-sub" style={{ marginTop: waiting.items.length > 0 ? 10 : 0 }}>{others} They are counted on the left.</p>}
    </section>
  )
}

const STARTS = [
  { kind: 'text' as const, icon: 'file-text' as const, name: 'Text', line: 'A new document', tip: 'Make a new document in this project' },
  { kind: 'table' as const, icon: 'table' as const, name: 'Table', line: 'CSV data', tip: 'Make a new table in this project' },
  { kind: 'web' as const, icon: 'globe' as const, name: 'Web page', line: 'Open a site', tip: 'Open a web page in a new tab' },
]

function StartSomething({ name }: { name: string }) {
  return (
    <section aria-label={`Start something in ${name}`}>
      <h2 className="rh-h3">Start something in {name}</h2>
      <div className="rh-tiles">
        {STARTS.map((start) => (
          <Tooltip key={start.kind} label={start.tip} className="block">
            <Button variant="ghost" className="rh-tile grid w-full h-auto items-start justify-items-start justify-start text-left whitespace-normal" onClick={() => send({ type: 'home/start', kind: start.kind })}>
              <span className="rh-ic"><Icon name={start.icon} size={16} tone="inherit" /></span>
              <span><b>{start.name}</b><small>{start.line}</small></span>
            </Button>
          </Tooltip>
        ))}
      </div>
    </section>
  )
}

function LastChanged({ state, now }: { state: HomeState; now: number }) {
  if (!state.recent || state.recent.length === 0) return null
  return (
    <section aria-label={`Last changed in ${state.project.name}`}>
      <h2 className="rh-h3">Last changed in {state.project.name}</h2>
      <div>
        {state.recent.map((file) => (
          <button key={file.id} type="button" className="rh-file" onClick={() => send({ type: 'home/open-recent', id: file.id })}>
            <Icon name={recentIcon(file)} size={14} tone="muted" />
            <span>{file.name}{file.extension && <span className="rh-ext">{file.extension}</span>}</span>
            {file.folder && <span className="rh-where">in {file.folder}</span>}
            <span className="rh-when">{whenWords(file.changedAt, now, 'days')}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function DropFiles() {
  const [over, setOver] = useState(false)
  const accepts = (event: DragEvent) => Array.from(event.dataTransfer.types).some((type) => type === 'text/uri-list' || type === 'Files')
  return (
    <section aria-label="Bring work in">
      <h2 className="rh-h3">Or bring work in</h2>
      <div
        className={`rh-drop${over ? ' over' : ''}`}
        onDragOver={(event) => {
          if (!accepts(event)) return
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          const uris = (event.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('file:'))
          if (uris.length > 0) send({ type: 'home/drop-files', uris: uris.slice(0, 200) })
          else send({ type: 'home/add-files' })
        }}
      >
        <span className="rh-ic"><Icon name="tray-arrow-down" size={16} tone="inherit" /></span>
        <span><b>Drop files here</b>Word, PDF, spreadsheets, notes. They are copied into this project; the originals stay where they are.</span>
        <Tooltip label="Choose files to copy into this project" className="rh-drop-action">
          <Button variant="outline" size="sm" onClick={() => send({ type: 'home/add-files' })}>Choose files…</Button>
        </Tooltip>
      </div>
    </section>
  )
}

function Missing({ state }: { state: HomeState }) {
  const missing = state.missing!
  return (
    <div className="rh-desk">
      <div className="rh-page no-cover">
        <span className="rh-mark muted" aria-hidden="true">{missing.mark}</span>
        <h1 className="rh-name">{missing.name}</h1>
        <section className="rh-missing" aria-label="This project's folder is not where it was">
          <h3>This project’s folder is not where it was</h3>
          <p>It may have been moved or renamed, or it is on a drive that is not connected now.</p>
          <span className="rh-path"><Icon name="folder-simple" size={14} tone="inherit" />{missing.place}</span>
          <div className="rh-actions">
            <Tooltip label="Choose the folder where this project is now">
              <Button size="sm" onClick={() => send({ type: 'home/find-missing', id: missing.id })}><Icon name="magnifying-glass" size={14} tone="inherit" />Find it…</Button>
            </Tooltip>
            <Tooltip label="Take it off the list; the folder stays as it is">
              <Button variant="outline" size="sm" onClick={() => send({ type: 'home/remove-missing', id: missing.id })}>Remove from the list</Button>
            </Tooltip>
          </div>
          <p className="rh-foot">Removing it from the list leaves the folder alone, wherever it is. You stay in {state.project.name} meanwhile.</p>
        </section>
        <div style={{ marginTop: 16 }}>
          <Tooltip label={`Back to ${state.project.name}’s Home`}>
            <Button variant="ghost" size="sm" onClick={() => send({ type: 'home/dismiss-missing' })}><Icon name="caret-left" size={12} tone="inherit" />{state.project.name}</Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export function HomeView({ state, coverDefault, now }: { state: HomeState; coverDefault: string; now: number }) {
  if (state.missing) return <Missing state={state} />
  const cover = state.project.coverUrl ?? coverDefault
  return (
    <div className="rh-desk">
      <div className="rh-cover" style={{ backgroundImage: `url("${cover.replace(/"/g, '%22')}")` }} role="img" aria-label="The project's cover picture">
        <Tooltip label="Choose a picture for this project's cover" className="rh-change">
          <Button className="rh-chip-button" onClick={() => send({ type: 'home/change-cover' })}><Icon name="image" size={14} tone="inherit" />Change image</Button>
        </Tooltip>
      </div>
      <main className="rh-page">
        <Head state={state} />
        {/* An empty project says so (R4; experience 29, frame 1). */}
        {state.empty && <p className="rh-sub rh-empty-line">{state.project.name} is empty for now. The AI works only inside this folder.</p>}
        {state.notice && (
          <div className="rh-notice" role="status">
            <Icon name="info" size={14} tone="inherit" />
            <span>{state.notice}</span>
            <Tooltip label="Hide this note" className="rh-notice-action">
              <Button variant="ghost" size="sm" onClick={() => send({ type: 'home/dismiss-notice' })}>OK</Button>
            </Tooltip>
          </div>
        )}
        {state.whatMoved && <WhatMoved />}
        <Waiting state={state} now={now} />
        <StartSomething name={state.project.name} />
        {state.empty ? <DropFiles /> : <LastChanged state={state} now={now} />}
      </main>
      {state.switchedFrom && (
        <div className="rh-toast" role="status">
          <span>Switched to {state.project.name}. {state.switchedFrom.name} is kept as you left it.</span>
          <Tooltip label={`Switch back to ${state.switchedFrom.name}`}>
            <Button variant="ghost" size="sm" className="rh-toast-action" onClick={() => send({ type: 'home/go-back' })}>Go back</Button>
          </Tooltip>
          <Tooltip label="Hide this note">
            <Button variant="ghost" size="icon-sm" className="rh-toast-action" aria-label="Hide this note" onClick={() => send({ type: 'home/dismiss-switched' })}><Icon name="x" size={12} tone="inherit" /></Button>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

export function HomePage() {
  const root = document.getElementById('root')
  const coverDefault = root?.getAttribute('data-cover') ?? ''
  const [state, setState] = useState<HomeState | null>(null)
  const now = useNow()
  useEffect(() => {
    const onMessage = (event: MessageEvent<HomeMessage>) => {
      if (event.data?.type === 'home/state') setState(event.data.state)
    }
    window.addEventListener('message', onMessage)
    send({ type: 'home/ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])
  if (!state) return <div className="rh-desk" aria-busy="true" />
  return <HomeView state={state} coverDefault={coverDefault} now={now} />
}
