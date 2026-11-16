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
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { Icon } from '../../ui/Icon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Tooltip } from '../../ui/tooltip'
import { themeStyle } from '../theme/themeVars'
import { SLIDE_ICONS, slideIcon } from './iconSet'
import { BOTTOM, CANVAS_HEIGHT, CANVAS_WIDTH, MAX_STEP, layoutSlide, type BoxStyle, type MarkBox, type SlideBox, type TextBox } from './layoutSlide'
// The slide's rules, shared with the published handout page (Sprint 159): every view that draws a slide gets them.
import './slide.css'

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
  editing?: SlideEditing
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
        editing.onText(box.path, box.multiline ? raw : raw.replace(/[\r\n\u2028\u2029]+/g, ' '))
      }}
      onKeyDown={event => {
        if (editing.onKey(box.path, event)) event.preventDefault()
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
        <div className="deck-icon-grid" role="group" aria-label="Icons">
          {SLIDE_ICONS.map(icon => (
            <Tooltip key={icon.name} label={icon.label}>
              <DropdownMenuItem
                aria-label={icon.label}
                data-state={icon.name === current ? 'on' : undefined}
                className="deck-icon-choice"
                onSelect={() => editing.onSetIcon(index, icon.name)}
              >
                <Icon name={icon.phosphor} size={16} tone="inherit" />
              </DropdownMenuItem>
            </Tooltip>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!current} onSelect={() => editing.onSetIcon(index, null)}>
          <Icon name="x" size={14} tone="inherit" />
          No icon
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Does anything on the drawn canvas run past the slide's bottom or out of its own box? */
function overflows(canvas: HTMLElement): boolean {
  for (const element of Array.from(canvas.children) as HTMLElement[]) {
    if (element.classList.contains('photo') || element.classList.contains('veil') || element.classList.contains('picbox')) continue
    if (element.offsetTop + element.offsetHeight > BOTTOM + 6) return true
    if (element.hasAttribute('data-fit') && element.scrollHeight > element.clientHeight + 2) return true
  }
  return false
}

export const SlideCanvas = memo(function SlideCanvas({ kind, data, width, theme, borderless, assets, editing }: SlideCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  // The measuring pass's step, for these words; new words start again from the estimate.
  const [fit, setFit] = useState<{ data: SlideData; kind: string; step: number }>({ data, kind, step: 0 })
  const step = fit.data === data && fit.kind === kind ? fit.step : 0
  const layout = layoutSlide(kind, data, { editing: !!editing, step })

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (step < MAX_STEP && overflows(canvas)) setFit({ data, kind, step: step + 1 })
    else if (fit.data !== data || fit.kind !== kind) setFit({ data, kind, step })
  })

  const scale = width / CANVAS_WIDTH
  return (
    <div className={`deck-slide${borderless ? ' is-borderless' : ''}`} style={{ width, height: Math.round(width * CANVAS_HEIGHT / CANVAS_WIDTH), ...(themeStyle(theme, borderless) as CSSProperties) }}>
      <div ref={canvasRef} className={`deck-sl${layout.known ? '' : ' is-unknown'}`} style={{ transform: `scale(${scale})` }} aria-hidden={editing ? undefined : true}>
        {layout.boxes.map(box => <Box key={box.key} box={box} editing={editing} assets={assets} />)}
      </div>
    </div>
  )
})
