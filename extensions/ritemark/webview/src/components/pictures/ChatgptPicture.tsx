/**
 * Pictures with ChatGPT (experience 49's ChatGPT, experience 46's "ChatGPT makes a picture for the slide"): the picture
 * bar's Make a new picture… and Change this picture…, the same in a Text document and on a slide.
 *
 *  - **Asking:** a small field anchored on the picture place, "Describe the picture" (or the change), starting from a
 *    suggestion (the slide's title). Make, or Enter. Esc, Cancel or a press outside closes it.
 *  - **While it's made:** a quiet pulse on the place and "ChatGPT is making the picture…" with Cancel. Typing elsewhere
 *    goes on: nothing here takes the caret.
 *  - **Done:** the picture is in its place (one undo step) and the strip says so, with Undo and Try another (a new
 *    version from the same words). A press outside or Esc closes it.
 *  - **Not signed in:** the host opens ChatGPT's sign-in card on the AI's sheet; the strip says where to look.
 *
 * The host makes the picture and saves it into `images/` (`src/pictures/chatgptPictureHost.ts`). Where the picture goes
 * is each editor's: `beforeMake` readies the place (a slide's replace target, the deck's slide id) and `placeMade`
 * puts a made picture in a document. Only ChatGPT is named, because Claude doesn't make pictures.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import { onMessage, sendToExtension } from '../../bridge'
import { imagePathOf } from '../../extensions/pictures/PictureNode'
import { sameRelativeImagePath } from '../../../../src/utils/imagePaths'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Tooltip } from '../ui/tooltip'
import { doneWords, followPicture, madeDescription, makeMessage, pictureKey, phaseAfterStatus, sentWords, type MakerPhase, type PictureDoc, type PictureMapping, type PictureAsk, type PicturePlaceRef } from './chatgptPictureState'

export type { MakerPhase, PictureAsk, PictureMode, PicturePlaceRef } from './chatgptPictureState'

export interface PictureMakerOptions {
  /** The editor whose words hold a `flow` place; its edits move the place. */
  editor: Editor | null
  /** The place on the screen now, or null when it's gone. */
  rectOf: (place: PicturePlaceRef) => DOMRect | null
  /** Before each request: ready the place; `slideId` in a deck. Null: the place is gone, nothing is asked. */
  beforeMake: (ask: PictureAsk) => { slideId?: string } | null
  /** A made picture into its place, in a document (a deck places it as a saved picture). */
  placeMade?: (place: PicturePlaceRef, picture: { path: string; url: string }, describe: Describe) => void
  /** Undo on the strip: the editor's own undo. */
  undo: () => void
  /** A request ended with no picture (Cancel, a failure, sign-in, the place gone): what `beforeMake` readied is let go. */
  onSettled?: (ask: PictureAsk) => void
}

/**
 * The made picture's description from the one standing there now (its words and path): the words asked, unless the
 * person wrote their own (`madeDescription`).
 */
export type Describe = (currentAlt: string, currentPath: string | null) => string

let serial = 0
const newRequestId = () => `picture-${Date.now().toString(36)}-${(serial += 1)}`

/** The ChatGPT picture's state for one editor, and what its strip's buttons do. */
export function usePictureMaker(options: PictureMakerOptions) {
  const [state, setPhase] = useState<MakerPhase>({ phase: 'idle' })
  const stateRef = useRef(state)
  stateRef.current = state
  // Each change is seen at once by the next event, before React draws it (two transactions in a row).
  const setState = useCallback((next: MakerPhase) => {
    stateRef.current = next
    setPhase(next)
  }, [])
  const latest = useRef(options)
  latest.current = options

  // A picture in the words is followed through edits (typing elsewhere goes on); deleted, its place is gone.
  const placeRef = useRef<PicturePlaceRef | null>(null)
  placeRef.current = state.phase === 'idle' ? null : state.ask.place
  useEffect(() => {
    const editor = options.editor
    if (!editor) return
    const follow = ({ transaction }: { transaction: { docChanged: boolean; doc: PictureDoc; mapping: PictureMapping } }) => {
      const current = stateRef.current
      if (!transaction.docChanged || current.phase === 'idle' || current.ask.place.kind !== 'flow') return
      const path = current.ask.place.path
      const pos = followPicture(transaction.doc, transaction.mapping, current.ask.place.pos, path ? attrs => sameRelativeImagePath(imagePathOf(attrs) ?? '', path) : undefined)
      if (pos === null) {
        // The picture went: a request still running is stopped, and nothing stays anchored on nothing.
        if (current.phase === 'making') {
          sendToExtension('picture/cancel', { requestId: current.requestId })
          latest.current.onSettled?.(current.ask)
        }
        setState({ phase: 'idle' })
        return
      }
      if (pos !== current.ask.place.pos) setState({ ...current, ask: { ...current.ask, place: { ...current.ask.place, pos } } } as MakerPhase)
    }
    editor.on('transaction', follow)
    return () => { editor.off('transaction', follow) }
  }, [options.editor])

  // The words each picture this editor made was made with, by its path (Change knows ChatGPT's own description).
  const madeWith = useRef(new Map<string, string>())

  // The host's answers for this editor's request.
  const asked = useRef<string | null>(null)
  useEffect(() => onMessage(message => {
    if (message.type !== 'picture/status') return
    const current = stateRef.current
    const status = message as { requestId?: unknown; state?: unknown; problem?: unknown; path?: unknown; url?: unknown }
    const next = phaseAfterStatus(current, status, asked.current)
    if (!next) return
    if (current.phase === 'checking') asked.current = null
    if (next.phase === 'done' && typeof status.path === 'string' && typeof status.url === 'string') {
      // The words a picture was made with, by its path: a later change knows the description is still ChatGPT's.
      const asked = current.phase === 'making' ? current.description : ''
      const madePath = status.path
      latest.current.placeMade?.(next.ask.place, { path: status.path, url: status.url }, (currentAlt, currentPath) =>
        madeDescription(currentAlt, asked, currentPath ? madeWith.current.get(pictureKey(currentPath)) : undefined))
      madeWith.current.set(pictureKey(madePath), asked)
    } else if (current.phase === 'making') {
      latest.current.onSettled?.(current.ask)
    }
    setState(next)
  }), [])

  // An editor that goes while its picture is made (a slide left for another): its place goes with it, so the request
  // stops and nothing is placed where the person no longer looks.
  useEffect(() => () => {
    const current = stateRef.current
    if (current.phase === 'making') {
      sendToExtension('picture/cancel', { requestId: current.requestId })
      latest.current.onSettled?.(current.ask)
    }
  }, [])

  /** Make a new picture… or Change this picture…: ChatGPT's readiness first (its sign-in card when it isn't). */
  const start = useCallback((ask: PictureAsk) => {
    const current = stateRef.current
    if (current.phase === 'making') {
      sendToExtension('picture/cancel', { requestId: current.requestId })
      latest.current.onSettled?.(current.ask)
    }
    const requestId = newRequestId()
    asked.current = requestId
    setState({ phase: 'checking', ask })
    sendToExtension('picture/check', { requestId })
  }, [])

  const make = useCallback((description: string, ask?: PictureAsk) => {
    const current = stateRef.current
    const target = ask ?? (current.phase === 'idle' ? null : current.ask)
    const words = description.trim()
    if (!target || !words) return
    const ready = latest.current.beforeMake(target)
    if (!ready) { setState({ phase: 'idle' }); return }
    const requestId = newRequestId()
    setState({ phase: 'making', ask: target, description: words, requestId })
    sendToExtension('picture/make', makeMessage(target, words, requestId, ready.slideId))
  }, [])

  const cancel = useCallback(() => {
    const current = stateRef.current
    if (current.phase === 'making') {
      sendToExtension('picture/cancel', { requestId: current.requestId })
      latest.current.onSettled?.(current.ask)
    }
    setState({ phase: 'idle' })
  }, [])

  /** Try another: a new version from the same words, in the place of the one just made. */
  const tryAnother = useCallback(() => {
    const current = stateRef.current
    if (current.phase === 'done' || current.phase === 'failed') make(current.description, current.ask)
  }, [make])

  const undo = useCallback(() => {
    setState({ phase: 'idle' })
    latest.current.undo()
  }, [])

  const close = useCallback(() => setState({ phase: 'idle' }), [])

  return { state, start, make, cancel, tryAnother, undo, close, placeRef }
}

export type PictureMaker = ReturnType<typeof usePictureMaker>

/** Where the field or the strip sits: under the place, centred, inside the window; inside the place's foot otherwise. */
function placeUnder(rect: DOMRect, box: { width: number; height: number }, inside: boolean, bounds?: { left: number; right: number }): { left: number; top: number } {
  const minX = Math.max(8, (bounds?.left ?? 0) + 8)
  const maxX = Math.min(window.innerWidth, bounds?.right ?? window.innerWidth) - box.width - 8
  const left = Math.max(minX, Math.min(maxX, rect.left + rect.width / 2 - box.width / 2))
  const below = rect.bottom + 10
  const foot = Math.max(8, rect.bottom - box.height - 12)
  const top = inside ? foot : below + box.height + 8 <= window.innerHeight ? below : foot
  return { left: Math.round(left), top: Math.round(top) }
}

export interface PictureMakerViewProps {
  maker: PictureMaker
  rectOf: (place: PicturePlaceRef) => DOMRect | null
  /** A slide-wide place (a side or behind): the field and the strip sit inside it at its foot, as the bar does. */
  insideOf?: (place: PicturePlaceRef) => boolean
  /** On a slide, the stage's sides (the bar's rule). */
  boundsOf?: (place: PicturePlaceRef) => { left: number; right: number } | undefined
}

/** The field, the pulse and the strip, drawn in the window over the editor, following the place as it moves. */
export function PictureMakerView({ maker, rectOf, insideOf, boundsOf }: PictureMakerViewProps) {
  const { state } = maker
  const ref = useRef<HTMLDivElement | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const [words, setWords] = useState('')
  const place = state.phase === 'idle' ? null : state.ask.place

  // The field starts from its suggestion each time it opens, never again while it's open (an edit above the picture
  // moves its place, and the words typed stay).
  const asking = state.phase === 'asking'
  const suggestion = state.phase === 'asking' ? state.ask.suggestion : ''
  useEffect(() => { if (asking) setWords(suggestion) }, [asking])

  // Follows the place while shown: a scroll, the window, and a look every quarter second for what moves it otherwise
  // (the slide's fit, words typed above it), never a layout read every frame.
  useEffect(() => {
    if (!place) { setRect(null); return }
    const tick = () => {
      const next = rectOf(place)
      setRect(previous => (previous && next && previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height ? previous : next))
    }
    tick()
    const timer = window.setInterval(tick, 250)
    window.addEventListener('scroll', tick, true)
    window.addEventListener('resize', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('scroll', tick, true)
      window.removeEventListener('resize', tick)
    }
  }, [place?.kind, place?.kind === 'flow' ? place.pos : -1, rectOf])

  useLayoutEffect(() => {
    const box = ref.current
    if (!rect || !box || !place) { setAt(null); return }
    const next = placeUnder(rect, { width: box.offsetWidth, height: box.offsetHeight }, insideOf?.(place) ?? false, boundsOf?.(place))
    setAt(previous => (previous && previous.left === next.left && previous.top === next.top ? previous : next))
  })

  // Asking, done, failed and the sign-in line close on a press outside them and on Esc; the making strip stays.
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'making' || state.phase === 'checking') return
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || ref.current?.contains(target) || target.closest('[data-radix-popper-content-wrapper]')) return
      maker.close()
    }
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        maker.close()
        return
      }
      // Done: typing on goes on, and the strip goes with it, so its Undo never takes back words typed after the picture.
      const target = event.target as Element | null
      if (state.phase === 'done' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) && !(target && ref.current?.contains(target))) maker.close()
    }
    document.addEventListener('pointerdown', press, true)
    window.addEventListener('keydown', keys, true)
    return () => {
      document.removeEventListener('pointerdown', press, true)
      window.removeEventListener('keydown', keys, true)
    }
  }, [state.phase, maker.close])

  if (state.phase === 'idle' || state.phase === 'checking' || !rect) return null

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    // The editor under the field never gets its keys.
    event.stopPropagation()
  }
  const shell = 'picture-maker fixed z-[61] rounded-xl bg-surface font-ui text-ink-strong shadow-[0_0_0_1px_var(--r-hairline),0_10px_28px_-10px_rgba(30,27,75,.3)]'
  const style = { left: at?.left ?? -9999, top: at?.top ?? 0 }

  let body: JSX.Element
  if (state.phase === 'asking') {
    const change = state.ask.mode === 'change'
    body = (
      <form
        className="flex w-[340px] flex-col gap-2.5 p-3"
        onSubmit={event => {
          event.preventDefault()
          maker.make(words)
        }}
      >
        <label htmlFor="picture-maker-words" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-strong">
          <Icon name="sparkle" size={14} tone="inherit" />
          {change ? 'Change this picture with ChatGPT' : 'Make a new picture with ChatGPT'}
        </label>
        <Input
          id="picture-maker-words"
          autoFocus
          value={words}
          placeholder={change ? 'Describe the change' : 'Describe the picture'}
          onChange={event => setWords(event.target.value)}
          onFocus={event => event.currentTarget.select()}
        />
        <p className="m-0 text-[12px] leading-[17px] text-ink-muted">{sentWords(state.ask)}</p>
        <div className="flex justify-end gap-2 pt-0.5">
          <Tooltip label="Close without asking ChatGPT (Esc)">
            <Button type="button" variant="ghost" size="compact" onClick={maker.close}>Cancel</Button>
          </Tooltip>
          <Tooltip label={words.trim() ? 'Ask ChatGPT for the picture (Enter)' : 'Describe the picture first'}>
            <Button type="submit" size="compact" disabled={!words.trim()}>
              <Icon name="sparkle" size={14} tone="inherit" />
              {change ? 'Change' : 'Make'}
            </Button>
          </Tooltip>
        </div>
      </form>
    )
  } else if (state.phase === 'making') {
    body = (
      <div className="flex items-center gap-2 py-1 pl-3 pr-1.5" role="status" aria-live="polite">
        <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin" />
        <span className="whitespace-nowrap text-[13px]">ChatGPT is making the picture…</span>
        <Tooltip label="Stop making the picture">
          <Button type="button" variant="ghost" size="compact" onClick={maker.cancel}>Cancel</Button>
        </Tooltip>
      </div>
    )
  } else if (state.phase === 'done') {
    body = (
      <div className="flex items-center gap-2 py-1 pl-3 pr-1.5" role="status" aria-live="polite">
        <Icon name="check-circle" size={14} tone="inherit" />
        <span className="whitespace-nowrap text-[13px]">{doneWords(state.ask.mode)}</span>
        <Tooltip label="Put the picture back as it was">
          <Button type="button" variant="ghost" size="compact" onClick={maker.undo}>
            <Icon name="arrow-counter-clockwise" size={14} tone="inherit" />
            Undo
          </Button>
        </Tooltip>
        <Tooltip label="A new version from the same words">
          <Button type="button" variant="ghost" size="compact" onClick={maker.tryAnother}>
            <Icon name="arrows-clockwise" size={14} tone="inherit" />
            Try another
          </Button>
        </Tooltip>
      </div>
    )
  } else if (state.phase === 'failed') {
    body = (
      <div className="flex items-center gap-2 py-1 pl-3 pr-1.5" role="alert">
        <Icon name="warning-circle" size={14} tone="inherit" />
        <span className="whitespace-nowrap text-[13px]">{state.problem}</span>
        {state.description ? (
          <Tooltip label="Ask ChatGPT again with the same words">
            <Button type="button" variant="ghost" size="compact" onClick={maker.tryAnother}>Try again</Button>
          </Tooltip>
        ) : null}
      </div>
    )
  } else {
    body = (
      <div className="flex items-center gap-2 py-1.5 pl-3 pr-3" role="status">
        <Icon name="sign-in" size={14} tone="inherit" />
        <span className="whitespace-nowrap text-[13px]">Sign in to ChatGPT first, then try again.</span>
      </div>
    )
  }

  return createPortal(
    <>
      {state.phase === 'making' ? (
        <div
          aria-hidden
          className="picture-making-pulse"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      ) : null}
      <div
        ref={ref}
        className={shell}
        style={style}
        // A press on it never takes the editor's caret, except in the field.
        onMouseDown={event => { if (!(event.target as HTMLElement).closest('input')) event.preventDefault() }}
        onKeyDown={keys}
      >
        {body}
      </div>
    </>,
    document.body,
  )
}
