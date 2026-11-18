/**
 * Sprint 157: one slide, laid out on a fixed 960 × 540 canvas (`layoutSlide`) and scaled to the width it is given:
 * the stage, a thumbnail. The theme reaches it as `--s-*` custom properties (`themeVars`), Card or Borderless.
 *
 * After drawing, a measuring pass checks the real font metrics: when a box still runs past the slide's bottom or out
 * of its own box, the layout is asked for one size smaller, up to `MAX_STEP`. It runs in a layout effect, so the
 * steps never reach the screen.
 *
 * On the stage the words are edited in place (`editing`): each text box is a small plain-text editing host, kept
 * uncontrolled while it has the caret so typing is never redrawn under the person.
 */
import { memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { isBlockSlide, type SlideData } from '../../../../../src/decks/deckFormat'
import { BLOCK_CANVAS_HEIGHT, BLOCK_CANVAS_WIDTH, blockCanvasMarkup, blockHasAgenda, drawsLogo, themeSlideLogo, type SlideLogo } from '../../../../../src/decks/blocks/slideRenderer'
import { AgendaContext } from './agendaContext'
import { blockDataOf, drawsAsBlocks } from '../../../../../src/decks/blocks/convertDeck'
import { deckFont, type DeckTheme } from '../../../../../src/decks/deckTheme'
import { Icon } from '../../ui/Icon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { themeStyle } from '../theme/themeVars'
import { slideIcon } from './iconSet'
import { IconGridItems } from './IconGrid'
import { oneLine } from './slideEdits'
import { isLayoutTitleSlide } from './slideMarkup'
import { BOTTOM, CANVAS_HEIGHT, CANVAS_WIDTH, MAX_STEP, editedItemWords, layoutSlide, pastedItemWords, type BoxStyle, type MarkBox, type SlideBox, type TextBox } from './layoutSlide'
// The slide's rules, shared with the published handout page (Sprint 159): every view that draws a slide gets them.
import './slide.css'
import { fitFlow, fitKeyOf, fitLookOf, stageFitFor, subscribeStageFit } from '../blocks/slideFit'

export { CANVAS_HEIGHT, CANVAS_WIDTH }

/** What the stage does with the person's typing; absent on thumbnails. */
export interface SlideEditing {
  /** The words at `path` are now `value`. */
  onText: (path: string, value: string) => void
  /** A key in a text box; true when the stage handled it (Enter adds an item, Backspace on an empty one removes it). */
  onKey: (path: string, event: ReactKeyboardEvent<HTMLElement>) => boolean
  /** An item's icon, chosen from the grid (null: no icon). */
  onSetIcon: (index: number, name: string | null) => void
  /** The text box to put the caret in once it is drawn, and the call that says it was. */
  focusPath: string | null
  /** Sprint 159 (PR 7): select the words whole rather than put the caret after them. */
  focusSelect?: boolean
  onFocused: () => void
}

interface SlideCanvasProps {
  kind: string
  data: SlideData
  width: number
  theme: DeckTheme
  borderless: boolean
  /** The slide's pictures as webview URIs, by the paths the slide names. */
  assets: Record<string, string>
  /** 17 November: the pictures the host looked for and didn't find, drawn as missing with their names (the strip). */
  missing?: ReadonlySet<string>
  editing?: SlideEditing
  /**
   * Small details 14: the slide's place in the deck (from 1), in Present only: an Agenda on it mutes the sections
   * passed and puts the next one in the accent. Elsewhere an Agenda draws the list alone.
   */
  at?: number
  /**
   * Decks README item 18, in Present only (the wall, the presenter view's Now and Next): how many items of the slide's
   * One by one blocks show; the rest keep their places, hidden. Left out, every item shows, as everywhere else.
   */
  reveal?: number
}

const px = (style: BoxStyle | undefined): CSSProperties | undefined => {
  if (!style) return undefined
  return Object.fromEntries(Object.entries(style).map(([key, value]) => [key, typeof value === 'number' && key !== 'fontWeight' ? `${value}px` : value])) as CSSProperties
}

/**
 * The text of a multi-line editing host, its lines as the person sees them. Chromium may write a typed line break as
 * a `<br>` or a `<div>`, which `textContent` runs together; `innerText` reads them as line breaks. The one empty line a
 * trailing `<br>` adds is not the person's.
 */
export function editedText(element: HTMLElement): string {
  const text = element.innerText ?? element.textContent ?? ''
  return element.lastChild?.nodeName === 'BR' ? text.replace(/\n$/, '') : text
}

/** The box's words before the caret, or null when the caret isn't in it. */
function wordsBeforeCaret(element: HTMLElement): string | null {
  const selection = element.ownerDocument.getSelection()
  if (!selection || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!element.contains(range.startContainer)) return null
  const before = element.ownerDocument.createRange()
  before.setStart(element, 0)
  before.setEnd(range.startContainer, range.startOffset)
  return before.toString()
}

/** An emptied editing host without its stray children, so it reads as `:empty`; the caret stays in it when it had it. */
function clearKeepingCaret(element: HTMLElement) {
  const focused = element.ownerDocument.activeElement === element
  element.replaceChildren()
  if (!focused) return
  const selection = element.ownerDocument.getSelection()
  selection?.removeAllRanges()
  const range = element.ownerDocument.createRange()
  range.setStart(element, 0)
  range.collapse(true)
  selection?.addRange(range)
}

/** One of the slide's words: plain text, or a small editing host on the stage. */
function SlideText({ box, editing, tag = 'div' }: { box: TextBox; editing?: SlideEditing; tag?: 'div' | 'span' }) {
  const ref = useRef<HTMLElement>(null)
  // Uncontrolled while it has the caret: the person's typing is the text; otherwise the slide's words are.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (document.activeElement !== element && element.textContent !== box.text) element.textContent = box.text
  })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !editing || editing.focusPath !== box.path) return
    element.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(element)
    if (!editing.focusSelect) range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    editing.onFocused()
  })
  const Tag = tag
  if (!editing) {
    return <Tag className={box.cls || undefined} style={px(box.style)}>{box.text}</Tag>
  }
  return (
    <Tag
      ref={ref as never}
      className={box.cls || undefined}
      style={px(box.style)}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline={box.multiline ? true : undefined}
      aria-label={box.placeholder || 'Words on the slide'}
      data-ph={box.placeholder}
      data-path={box.path}
      onInput={event => {
        // A line typed with Enter may arrive as a <br> or a <div>: `innerText` reads each as a line break.
        const raw = box.multiline ? editedText(event.currentTarget) : event.currentTarget.textContent ?? ''
        // Emptied, Chromium leaves a <br> behind, so the box doesn't read as :empty and its placeholder (an empty
        // pill's faint default) never shows: the box is cleared, with the caret kept in it.
        // Never mid-composition (an IME's or a dead key's marked text): the browser holds that text and would lose it.
        if (raw === '' && event.currentTarget.firstChild && !(event.nativeEvent as InputEvent).isComposing) clearKeepingCaret(event.currentTarget)
        const words = box.multiline ? raw : oneLine(raw)
        // An item whose marker the stage hides ("1. " before "Sisend") keeps it in the file when its words are edited.
        editing.onText(box.path, box.marks ? editedItemWords(words, box) : words)
      }}
      // Words pasted at the start of an item the layout numbers or dots itself ("1. Sisend" from a list) leave their
      // marker behind, so the item is written clean and never shows its number twice (Jarmo, 16 November).
      onPaste={event => {
        if (!box.marks) return
        const pasted = event.clipboardData.getData('text/plain')
        const before = wordsBeforeCaret(event.currentTarget)
        if (!pasted || before === null) return
        const clean = pastedItemWords(pasted, before, box)
        if (clean === pasted) return
        event.preventDefault()
        event.stopPropagation()
        // As typing would put it in: one input event, so the words are written as any other edit.
        event.currentTarget.ownerDocument.execCommand('insertText', false, clean)
      }}
      onKeyDown={event => {
        if (editing.onKey(box.path, event)) event.preventDefault()
      }}
      // The input that emptied the box came mid-composition, so it wasn't cleared then: it is now.
      onCompositionEnd={event => {
        const element = event.currentTarget
        if (!element.textContent && element.firstChild) clearKeepingCaret(element)
      }}
      // Emptied words may leave a stray <br> behind: cleared, so the box reads as empty (its placeholder; an empty
      // pill goes once the caret leaves).
      onBlur={event => {
        const element = event.currentTarget
        // A pill of spaces is no pill (`exerciseTagOf`), so it reads as empty too and goes.
        const text = element.textContent ?? ''
        if ((box.path === 'tag' ? !text.trim() : !text) && element.firstChild) clearKeepingCaret(element)
      }}
    />
  )
}

function Box({ box, editing, assets }: { box: SlideBox; editing?: SlideEditing; assets: Record<string, string> }) {
  switch (box.type) {
    case 'text':
      return <SlideText box={box} editing={editing} />
    case 'mark': {
      const icon = box.icon ? (box.icon === 'plus' ? 'plus' : box.icon === 'arrow-right' ? 'arrow-right' : slideIcon(box.icon)?.phosphor) : undefined
      const glyph = icon ? <Icon name={icon} size={20} tone="inherit" /> : box.text
      if (editing && box.iconIndex !== undefined) {
        return <IconPicker box={box} glyph={glyph} editing={editing} />
      }
      return <span className={box.cls} style={px(box.style)}>{glyph}</span>
    }
    case 'group':
      return (
        <div className={box.cls} style={px(box.style)} data-fit="">
          {box.children.map(child => <Box key={child.key} box={child} editing={editing} assets={assets} />)}
        </div>
      )
    case 'list':
      return (
        <ol className="pts" style={px(box.style)} data-fit="">
          {box.items.map(item => (
            <li key={item.key} style={{ marginBottom: box.gap }}>
              <SlideText box={item.heading} editing={editing} tag="span" />
              {item.text ? <SlideText box={{ ...item.text, style: box.subStyle }} editing={editing} tag="span" /> : null}
            </li>
          ))}
        </ol>
      )
    case 'table':
      return (
        <table className="tbl" style={px(box.style)} data-fit="">
          <tbody>
            {box.rows.map(row => (
              <tr key={row.key}>
                {row.cells.map(cell => {
                  const text: TextBox = { type: 'text', key: cell.path, cls: '', path: cell.path, text: cell.text, placeholder: cell.head ? 'Heading' : '' }
                  const Cell = cell.head ? 'th' : 'td'
                  return (
                    <Cell key={cell.path} style={{ padding: box.cellPadding }}>
                      <SlideText box={text} editing={editing} />
                    </Cell>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'picture': {
      const url = box.image ? assets[box.image] : undefined
      const style: CSSProperties = { ...px(box.style), ...(url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")` } : {}) }
      if (box.cls === 'picbox') {
        return (
          <div className={`picbox${url ? '' : ' empty'}`} style={px(box.style)}>
            {url ? <img src={url} alt="" /> : editing ? <span>Paste or drop a picture<br /><small>a screenshot, a chart, a photo</small></span> : null}
          </div>
        )
      }
      return <div className={`photo${url ? '' : ' empty'}`} style={style} />
    }
  }
}

/** A box's icon on the stage: a click opens the grid of 24 (prototype frame 4), with No icon under it. */
function IconPicker({ box, glyph, editing }: { box: MarkBox; glyph: ReactNode; editing: SlideEditing }) {
  const index = box.iconIndex ?? 0
  const current = box.icon === 'plus' ? null : slideIcon(box.icon)?.name ?? null
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <span
          className={`${box.cls} pickic`}
          style={px(box.style)}
          role="button"
          tabIndex={0}
          aria-label={current ? 'Change the icon' : 'Add an icon'}
          onMouseDown={event => event.preventDefault()}
        >
          {glyph}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto max-w-none">
        <IconGridItems current={current} onPick={name => editing.onSetIcon(index, name)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Sprint 162 PR 4: the theme's logo in its corner of the canvas, as `slideLogoHtml` draws it for the page and the
 * block slides: an `<img>` (an SVG never goes into the slide as markup), or nothing for a slide it isn't on.
 */
export function SlideLogoImage({ logo, cover }: { logo: SlideLogo | null; cover: boolean }) {
  if (!drawsLogo(logo, cover)) return null
  return <img className={`slide-logo is-${logo.place}`} src={logo.url} alt="" draggable={false} />
}

/** Does anything on the drawn canvas run past the slide's bottom or out of its own box? */
function overflows(canvas: HTMLElement): boolean {
  for (const element of Array.from(canvas.children) as HTMLElement[]) {
    // The pictures fill their places, and the logo sits in its corner: neither is words to fit.
    if (element.classList.contains('photo') || element.classList.contains('veil') || element.classList.contains('picbox') || element.classList.contains('slide-logo')) continue
    if (element.offsetTop + element.offsetHeight > BOTTOM + 6) return true
    if (element.hasAttribute('data-fit') && element.scrollHeight > element.clientHeight + 2) return true
  }
  return false
}

/**
 * Sprint 161: a block slide (format v2), drawn by the one block renderer (`src/decks/blocks/slideRenderer.ts`) that the
 * wall, the presenter view, the library and the page draw it with. The stage edits it in its own slide editor
 * (`blocks/SlideEditor.tsx`); this canvas draws the strip, the wall and the rest. The fit steps the words down while
 * they overflow (`--fit`, 100 to 60 %), and again once the fonts load.
 */
const BlockSlideCanvas = memo(function BlockSlideCanvas({ data, width, theme, borderless, assets, missing, at, reveal }: Omit<SlideCanvasProps, 'kind' | 'editing'>) {
  const slideRef = useRef<HTMLDivElement>(null)
  const markdown = data.markdown ?? ''
  // Small details 14: the deck around an Agenda block; a slide without one draws nothing new when the sections change.
  const deckAgenda = useContext(AgendaContext)
  const agenda = blockHasAgenda(markdown) ? deckAgenda : null
  const agendaAt = agenda ? at : undefined
  // The fit belongs to these words in this look: a theme or Card | Borderless change measures again from the top.
  const key = fitKeyOf(markdown, data.image, data.picture, fitLookOf(borderless, theme))
  // 17 November: the slide on the stage is drawn here at the stage's own step, so a thumbnail is its scaled copy.
  const stageStep = useSyncExternalStore(subscribeStageFit, () => stageFitFor(key), () => stageFitFor(key))
  const [fit, setFit] = useState<{ key: string; step: number }>({ key, step: 0 })
  const step = stageStep ?? (fit.key === key ? fit.step : 0)
  const [again, setAgain] = useState(0)
  // A slide measured before Sofia Sans loads can end a step too small (spike §5): measure again from the top.
  useEffect(() => {
    const fontSet = document.fonts
    if (!fontSet) return
    const remeasure = () => setAgain(count => count + 1)
    fontSet.addEventListener?.('loadingdone', remeasure)
    return () => fontSet.removeEventListener?.('loadingdone', remeasure)
  }, [])
  // Sprint 162 PR 4: the theme's logo, kept while its address, corner and where it shows stay (a new theme object
  // with the same logo draws nothing new).
  const logoUrl = theme.logoUrl
  const logoPlace = theme.logo?.place
  const logoOn = theme.logo?.on
  const logoAspect = theme.logoAspect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logo = useMemo(() => themeSlideLogo(theme), [logoUrl, logoPlace, logoOn, logoAspect])
  const html = useMemo(
    () => blockCanvasMarkup(data, { step, width, pictureUrl: path => assets[path] ?? null, missing: missing ? path => missing.has(path) : undefined, logo, agenda, at: agendaAt, reveal }),
    [data, step, width, assets, missing, logo, agenda, agendaAt, reveal],
  )
  // The stage's one measure (`fitFlow`), from the top: words past the top, the bottom or a right edge step it down.
  useLayoutEffect(() => {
    if (stageStep !== null) return
    const flow = slideRef.current?.querySelector<HTMLElement>('.blk-flow')
    if (!flow) return
    const found = fitFlow(flow, 0).step
    // Measured again only when what it draws changes (its words, look, fonts or pictures), never for its own answer.
    setFit(current => (current.key === key && current.step === found ? current : { key, step: found }))
  }, [html, again, stageStep, key])
  // A picture that loads after the slide is drawn takes its height then: measure again from the top (Codex on #760).
  useEffect(() => {
    const pending = Array.from(slideRef.current?.querySelectorAll('img') ?? []).filter(image => !image.complete)
    if (!pending.length) return
    const remeasure = () => setAgain(count => count + 1)
    for (const image of pending) image.addEventListener('load', remeasure, { once: true })
    return () => { for (const image of pending) image.removeEventListener('load', remeasure) }
  }, [html])
  return (
    <div
      ref={slideRef}
      className={`deck-slide${borderless ? ' is-borderless' : ''}`}
      data-step={step}
      style={{ width, height: Math.round(width * BLOCK_CANVAS_HEIGHT / BLOCK_CANVAS_WIDTH), ...(themeStyle(theme, borderless) as CSSProperties) }}
      // The renderer's own markup: every word escaped, raw HTML never drawn, no script, no link (slideRenderer.ts).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

export const SlideCanvas = memo(function SlideCanvas({ kind, data, width, theme, borderless, assets, missing, editing, at, reveal }: SlideCanvasProps) {
  if (isBlockSlide(kind)) return <BlockSlideCanvas data={data} width={width} theme={theme} borderless={borderless} assets={assets} missing={missing} at={at} reveal={reveal} />
  // PR 2 (decision 8 of the approved plan): a v1 slide of the nine kinds is drawn as the block slide its first edit
  // writes (`legacyToBlocks`), so the strip, the wall and the stage show what the conversion will write.
  if (drawsAsBlocks(kind)) return <BlockSlideCanvas data={blockDataOf(kind, data)} width={width} theme={theme} borderless={borderless} assets={assets} missing={missing} />
  return <LayoutSlideCanvas kind={kind} data={data} width={width} theme={theme} borderless={borderless} assets={assets} editing={editing} />
})

const LayoutSlideCanvas = memo(function LayoutSlideCanvas({ kind, data, width, theme, borderless, assets, editing }: SlideCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  // The measuring pass's step, for these words in these fonts; new words, another font (Sprint 162 PR 3) or a font
  // that has just loaded start again from the estimate.
  const [loaded, setLoaded] = useState(0)
  const fonts = `${theme.fh}\u0000${theme.fb}\u0000${loaded}`
  const [fit, setFit] = useState<{ data: SlideData; kind: string; fonts: string; step: number }>({ data, kind, fonts, step: 0 })
  const same = fit.data === data && fit.kind === kind && fit.fonts === fonts
  const step = same ? fit.step : 0
  const layout = layoutSlide(kind, data, { editing: !!editing, step })

  // Only a face of this slide's own fonts measures it again (the review of #777: a strip of 40 slides would all
  // start again for every font any view loads).
  const heading = deckFont(theme.fh).name
  const body = deckFont(theme.fb).name
  useEffect(() => {
    const fontSet = document.fonts
    if (!fontSet) return
    const remeasure = (event: Event) => {
      const faces = (event as Event & { fontfaces?: ReadonlyArray<FontFace> }).fontfaces
      if (!faces || faces.some(face => { const family = face.family.replace(/^["']|["']$/g, ''); return family === heading || family === body })) setLoaded(count => count + 1)
    }
    fontSet.addEventListener?.('loadingdone', remeasure)
    return () => fontSet.removeEventListener?.('loadingdone', remeasure)
  }, [heading, body])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (step < MAX_STEP && overflows(canvas)) setFit({ data, kind, fonts, step: step + 1 })
    else if (!same) setFit({ data, kind, fonts, step })
  })

  const scale = width / CANVAS_WIDTH
  return (
    // `data-step`: the fit the measuring pass found, which Publish sends for the page's slides (Sprint 159 PR 4).
    <div className={`deck-slide${borderless ? ' is-borderless' : ''}`} data-step={step} style={{ width, height: Math.round(width * CANVAS_HEIGHT / CANVAS_WIDTH), ...(themeStyle(theme, borderless) as CSSProperties) }}>
      <div ref={canvasRef} className={`deck-sl${layout.known ? '' : ' is-unknown'}`} style={{ transform: `scale(${scale})` }} aria-hidden={editing ? undefined : true}>
        {layout.boxes.map(box => <Box key={box.key} box={box} editing={editing} assets={assets} />)}
        <SlideLogoImage logo={themeSlideLogo(theme)} cover={isLayoutTitleSlide(kind)} />
      </div>
    </div>
  )
})
