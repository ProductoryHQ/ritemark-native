/**
 * Home (Sprint 134, R4, R11, R13): the project's own page, first tab on the desk.
 * - the cover (Ritemark's picture, or the project's own) with Change image;
 * - the project's mark and name, the folder it works in (opens Documents), its line;
 * - Waiting for you, with what waits in the other projects;
 * - Sprint 140 (R2): at most one guidance card under it: What moved, once, on a
 *   profile updated from Ritemark 1 (experience 32, frame 5); the ready request
 *   (experience 35); or the first-week question (experience 34, frame 1);
 * - Start something in <project>: Text, Table, Web page;
 * - Last changed in <project>; an empty project's drop target (experience 29, frame 1);
 * - a project of the list whose folder is not found (experience 33, frame 2).
 *
 * The host owns the state (`src/views/HomePanel.ts`); this page draws it and
 * sends what the person does. Every name is drawn as text, never as markup.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { HomeMessage, HomeState } from '../../../../src/projects/protocol'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { middleCut, noteEndsOn, othersWords, placeParts, recentIcon, SWITCH_NOTE_MS, waitingIcon, waitingWords, whenWords } from './homeWords'
import { ConversationBubbleIcon } from '../ai-sidebar/ConversationBubbleIcon'
import { send } from './homeClient'
import { GuidanceCard } from './GuidanceCards'
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
    <Tooltip label={line ? 'Edit the line about this project' : 'Write a line about this project'} side="bottom" className="block">
      <Button variant="ghost" className={`rh-line${line ? '' : ' empty'}`} onClick={() => setEditing(true)} aria-label={line ? `${line.replace(/[.!?…]+$/, '')}. Edit the line about this project` : 'Add a line about this project'}>
        {line || 'Add a line about this project'}
      </Button>
    </Tooltip>
  )
}

// A layout effect in the page, a plain effect when the page is rendered to markup (the tests)
const useLayoutEffectInPage = typeof document === 'undefined' ? useEffect : useLayoutEffect

/**
 * The folder's path, cut in the middle when the desk is narrow (#525; Sprint 142 R4, #557). One text node, measured,
 * so the ellipsis touches the next character: CSS's text-overflow left the rest of the start's box empty after it.
 * The line's room is the container's width less what the line holds besides the path (its icons, gaps, padding).
 * With `caret`, the › is drawn here, so a folder name that has to wrap keeps it after its last word.
 */
function PlaceText({ place, caret = false, title }: { place: string; caret?: boolean; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState<{ text: string; wrap: boolean; glue: boolean }>({ text: place, wrap: false, glue: false })
  useLayoutEffectInPage(() => {
    const span = ref.current
    const owner = span?.parentElement
    const container = owner?.parentElement
    if (!span || !owner || !container) return
    const canvas = document.createElement('canvas').getContext('2d')
    const measure = () => {
      if (!canvas) return
      const style = getComputedStyle(span)
      canvas.font = style.font
      const caretWidth = caret ? 18 : 0
      const room = container.clientWidth - (owner.offsetWidth - span.offsetWidth) - caretWidth
      const fits = (text: string) => canvas.measureText(text).width <= room
      const cutNow = room <= 0 ? { text: place, wrap: true } : middleCut(place, fits)
      // The last word keeps the › on its line only when the two fit a line; a longer word breaks anywhere
      const glue = cutNow.wrap && caret && cutNow.text.includes(' ') && fits(cutNow.text.slice(cutNow.text.lastIndexOf(' ') + 1))
      // When the line could show only the folder's name and that is the project's title just above, it shows only its
      // icon and ›; the whole path stays in the tooltip (experience 3, ritemark-dev b7fef7b)
      const folder = placeParts(place).folder
      const sameAsTitle = Boolean(title) && cutNow.text === folder && cutNow.text !== place && folder === title
      const next = sameAsTitle ? { text: '', wrap: false, glue: false } : { ...cutNow, glue }
      setCut((current) => (current.text === next.text && current.wrap === next.wrap && current.glue === next.glue ? current : next))
    }
    measure()
    const observer = new ResizeObserver(() => measure())
    observer.observe(container)
    void document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [place, caret, title])
  const caretIcon = caret ? <Icon name="caret-right" size={12} tone="muted" className="rh-place-caret" /> : null
  if (cut.text === '') return <span ref={ref} className="rh-place-text rh-place-iconly">{caretIcon}</span>
  // A name that wraps keeps the › after its last word (experience 3, ritemark-dev 76b3a50): the last word and the ›
  // go to a line together. A name with no spaces breaks anywhere instead.
  const lastSpace = cut.glue ? cut.text.lastIndexOf(' ') : -1
  return (
    <span ref={ref} className={`rh-place-text${cut.wrap ? ' rh-place-wrap' : ''}`}>
      {lastSpace > 0 && caretIcon
        ? <>{cut.text.slice(0, lastSpace + 1)}<span className="rh-place-last">{cut.text.slice(lastSpace + 1)}{caretIcon}</span></>
        : <>{cut.text}{caretIcon}</>}
    </span>
  )
}

function Head({ state }: { state: HomeState }) {
  const { project } = state
  return (
    <>
      <span className="rh-mark" aria-hidden="true">{project.mark}</span>
      <h1 className="rh-name">{project.name}</h1>
      {/* A block, not the tooltip's inline-flex: as a flex item the button came out a few pixels short of its text. */}
      {/* The whole path on the first line, as the line itself may be cut (#525) */}
      <Tooltip label={<><span className="block break-all">{project.place}</span><span className="block">Show its files in Documents</span></>} side="bottom" className="block max-w-full">
        <Button variant="ghost" className="rh-place max-w-full justify-start" onClick={() => send({ type: 'home/open-documents' })} aria-label={`${project.place}. Show its files in Documents`}>
          <Icon name="folder-simple" size={14} tone="inherit" />
          <PlaceText place={project.place} caret title={project.name} />
        </Button>
      </Tooltip>
      <ProjectLine line={project.line} />
    </>
  )
}

function WhatMoved({ copilotChat }: { copilotChat: boolean }) {
  return (
    <section className="rh-card" aria-label="What moved in Ritemark 2.0">
      <div className="rh-card-head">
        <span className="rh-version">2.0</span>
        What moved
        <Tooltip label="Close this, for good" className="rh-card-action">
          <Button variant="outline" size="sm" onClick={() => send({ type: 'home/what-moved-seen' })}>Got it</Button>
        </Tooltip>
      </div>
      <div className="rh-moved"><span className="rh-ic"><Icon name="terminal" size={12} tone="inherit" /></span><span><b>The terminal is a tab.</b> Yours sits beside your documents; a new one comes from the&nbsp;+.</span></div>
      {/* Only where there is one: Ritemark 1 never had Copilot Chat, and More shows it only while it is installed (Windows round 5) */}
      {copilotChat && <div className="rh-moved"><span className="rh-ic"><Icon name="dots-three" size={12} tone="inherit" /></span><span><b>Copilot Chat is in More,</b> at the end of the places on the left, and opens as a tab.</span></div>}
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
          <Tooltip key={item.id} label={item.source === 'card' ? 'Open this task’s page' : 'Open this chat on the AI’s sheet'} className="block">
          <Button variant="ghost" className="rh-row" onClick={() => send({ type: 'home/open-waiting', id: item.id })}>
            {/* An unread reply wears its chat's own bubble, as on the rail (the Experience lead, 19 October) */}
            {item.source === 'chat' && item.kind === 'reply' && item.colorSlot !== null
              ? <span className="rh-ic rh-ic-bubble"><ConversationBubbleIcon identityColorSlot={item.colorSlot} size={14} /></span>
              : <span className="rh-ic"><Icon name={waitingIcon(item)} size={14} tone="inherit" /></span>}
            {words.quote === undefined
              ? <span className="rh-text">{words.text}</span>
              : <span className="rh-text rh-quoted"><span className="rh-lead">{`${words.text} “`}</span><span className="rh-quote">{words.quote}</span><span className="rh-lead">”</span></span>}
            {words.tag && <span className="rh-tag">{words.tag}</span>}
            <span className="rh-when">{whenWords(item.since, now, 'minutes')}</span>
          </Button>
          </Tooltip>
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
          <Tooltip key={file.id} label="Open it in a tab" className="block">
          <Button variant="ghost" className="rh-file" onClick={() => send({ type: 'home/open-recent', id: file.id })}>
            <Icon name={recentIcon(file)} size={14} tone="muted" />
            <span className="rh-file-name">{file.name}{file.extension && <span className="rh-ext">{file.extension}</span>}</span>
            {file.folder && <span className="rh-where">in {file.folder}</span>}
            <span className="rh-when">{whenWords(file.changedAt, now, 'days')}</span>
          </Button>
          </Tooltip>
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
        <span className="rh-drop-text"><b>Drop files here</b>Word, PDF, spreadsheets, notes. They are copied into this project; the originals stay where they are.</span>
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
      <div className="rh-fit">
      <div className="rh-page no-cover">
        <span className="rh-mark muted" aria-hidden="true">{missing.mark}</span>
        <h1 className="rh-name">{missing.name}</h1>
        <section className="rh-missing" aria-label="This project's folder is not where it was">
          {/* What Find it… or Remove said, here in the box where the person is (S43) */}
          {state.notice && <p className="rh-missing-notice" role="status"><Icon name="info" size={14} tone="inherit" />{state.notice}</p>}
          <h3>This project’s folder is not where it was</h3>
          <p>It may have been moved or renamed, or it is on a drive that is not connected now.</p>
          <span className="rh-path"><Icon name="folder-simple" size={14} tone="inherit" /><PlaceText place={missing.place} /></span>
          <div className="rh-actions">
            <Tooltip label="Choose the folder where this project is now">
              <Button size="sm" onClick={() => send({ type: 'home/find-missing', id: missing.id })}><Icon name="magnifying-glass" size={14} tone="inherit" />Find it…</Button>
            </Tooltip>
            <Tooltip label="Take it off the list; the folder stays as it is">
              <Button variant="outline" size="sm" onClick={() => send({ type: 'home/remove-missing', id: missing.id })}>Remove from the list</Button>
            </Tooltip>
          </div>
          {missing.here
            ? <p className="rh-foot">Removing it from the list closes it in this window and leaves the folder alone, wherever it is.</p>
            : <p className="rh-foot">Removing it from the list leaves the folder alone, wherever it is. You stay in {state.project.name} meanwhile.</p>}
        </section>
        {/* The open project's own folder gone (S53): there is no Home of its own to go back to */}
        {!missing.here && (
          <div style={{ marginTop: 16 }}>
            <Tooltip label={`Back to ${state.project.name}’s Home`} className="rh-back">
              <Button variant="ghost" size="sm" onClick={() => send({ type: 'home/dismiss-missing' })}><Icon name="caret-left" size={12} tone="inherit" /><span className="rh-back-name">{state.project.name}</span></Button>
            </Tooltip>
          </div>
        )}
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
      <div className="rh-fit">
      <div className="rh-cover" style={{ backgroundImage: `url("${cover.replace(/"/g, '%22')}")` }} role="img" aria-label="The project's cover picture">
        <Tooltip label="Choose a picture for this project's cover" className="rh-change">
          <Button className="rh-chip-button" aria-label="Change image" onClick={() => send({ type: 'home/change-cover' })}><Icon name="image" size={14} tone="inherit" /><span className="rh-chip-label">Change image</span></Button>
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
        {/* Waiting for you first, whatever it holds; then at most one guidance card (Sprint 140, R2) */}
        <Waiting state={state} now={now} />
        <GuidanceCard guidance={state.guidance} whatMoved={<WhatMoved copilotChat={state.copilotChat} />} />
        <StartSomething name={state.project.name} />
        {state.empty ? <DropFiles /> : <LastChanged state={state} now={now} />}
      </main>
      </div>
      {state.switchedFrom && <SwitchNote here={state.project.name} from={state.switchedFrom.name} />}
    </div>
  )
}

/**
 * "Switched to … kept as you left it." with Go back (experience 3, frame 3; Sprint 142 R3, #557). One line at the
 * desk's foot. It goes 6 seconds after it shows, held while the pointer is on it or it has the keyboard's focus,
 * and at once when the person starts something on Home: a press outside it, a key, files dragged over, or Home
 * losing the keyboard to the rest of the window. The host ends it for a tab chosen or a message sent.
 */
function SwitchNote({ here, from }: { here: string; from: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const gone = useRef(false)
  const end = useCallback(() => {
    if (gone.current) return
    gone.current = true
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      send({ type: 'home/dismiss-switched' })
      return
    }
    setLeaving(true)
    window.setTimeout(() => send({ type: 'home/dismiss-switched' }), 160)
  }, [])
  // Six seconds, started again whenever the pointer and the focus have both left it
  useEffect(() => {
    if (hovered || focused) return
    const timer = window.setTimeout(end, SWITCH_NOTE_MS)
    return () => window.clearTimeout(timer)
  }, [hovered, focused, end])
  // At once, when the person starts something on Home
  useEffect(() => {
    const shownAt = Date.now()
    const inside = (target: EventTarget | null) => target instanceof Node && Boolean(ref.current?.contains(target))
    const onPointer = (event: PointerEvent) => {
      if (noteEndsOn({ type: 'pointerdown', insideNote: inside(event.target) })) end()
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (noteEndsOn({ type: 'keydown', insideNote: inside(event.target), key: event.key })) end()
    }
    const onDrag = (event: globalThis.DragEvent) => {
      const files = Array.from(event.dataTransfer?.types ?? []).some((type) => type === 'Files' || type === 'text/uri-list')
      if (noteEndsOn({ type: 'dragenter', insideNote: false, files })) end()
    }
    // The window settling after the switch can move the focus; only the person's own move ends the note
    const onBlur = () => {
      if (Date.now() - shownAt > 1500) end()
    }
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('dragenter', onDrag, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('dragenter', onDrag, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [end])
  return (
    <div
      ref={ref}
      className={`rh-toast${leaving ? ' leaving' : ''}`}
      role="status"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <span>Switched to {here}. {from} is kept as you left it.</span>
      <Tooltip label={`Switch back to ${from}`}>
        <Button variant="ghost" size="sm" className="rh-toast-action" onClick={() => send({ type: 'home/go-back' })}>Go back</Button>
      </Tooltip>
      <Tooltip label="Hide this note">
        <Button variant="ghost" size="icon-sm" className="rh-toast-action" aria-label="Hide this note" onClick={() => send({ type: 'home/dismiss-switched' })}><Icon name="x" size={12} tone="inherit" /></Button>
      </Tooltip>
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
