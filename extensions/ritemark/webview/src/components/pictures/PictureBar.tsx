/**
 * One picture editor (experience 49, frames 31 and 32 of experience 46): the bar under a chosen picture, the same in a
 * Text document and on a slide. Size S · M · L · Full, Align, Crop, the slide's Place, Description, Comment and ⋯;
 * in crop mode the crop's shapes, Reset and Done.
 *
 * Presentational: what each control does comes in as a callback (`PictureTools` for a picture in the words, the slide
 * editor for its side picture). The bar is drawn in the window (`document.body`) under the picture, at the window's own
 * size, so it reads the same on a slide drawn small. A press on it keeps the editor's caret and selection; Esc leaves
 * crop mode or the picture, and Enter is Done in crop mode. Its menu and its Description close on a press outside and
 * on Esc (Radix).
 *
 * ChatGPT's "Make a new picture…" and "Change this picture…" go between Comment and ⋯ (`ChatgptPicture.tsx`).
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CROP_PRESETS, PICTURE_SIZES, sizeOf, type PictureAlign, type PictureContext, type PictureLook, type PictureSize } from '../../../../src/markdown/pictureLook'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon, type PhosphorIconName } from '../ui/Icon'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Switch } from '../ui/switch'
import { Tooltip } from '../ui/tooltip'
import { isMac } from '../../hooks/usePlatform'
import { pictureBarPlacement, type Box } from './pictureGeometry'

export type PicturePlace = 'text' | 'left' | 'right' | 'behind'

export interface PictureBarProps {
  /** The picture on the screen; null hides the bar. */
  anchor: { left: number; top: number; width: number; height: number } | null
  context: PictureContext
  /** A picture in the words, or the slide's picture beside or behind them (it fills its place: no size or crop). */
  kind: 'flow' | 'side'
  look: PictureLook
  alt: string
  /** The picture has loaded (crop needs its shape). */
  canCrop: boolean
  /** Crop mode, with the shape chosen (`null` Original, undefined a free frame); null outside it. */
  crop: { ratio: string | null | undefined } | null
  /** The slide's Place group (slides only). */
  place?: PicturePlace
  /** Comments are on: the bar offers one on the picture. */
  comments: boolean
  /** An empty side place: there is no picture to describe, copy or show. */
  empty?: boolean
  onSize: (size: PictureSize) => void
  onAlign: (align: PictureAlign) => void
  onCrop: () => void
  onCropShape: (ratio: string | null) => void
  onCropReset: () => void
  onCropDone: () => void
  onCropCancel: () => void
  onPlace?: (place: PicturePlace) => void
  onWords: (alt: string, caption: boolean) => void
  onComment?: () => void
  /** ChatGPT: Make a new picture… ('new') or Change this picture… ('change'). Absent: no ChatGPT item. */
  onChatgpt?: (mode: 'new' | 'change') => void
  /** The picture is a file in the project, so ChatGPT can change it (a web address can't be sent). Default true. */
  chatgptCanChange?: boolean
  /**
   * Sprint 167 PR 4 (decks README item D): a side picture's Focus, first in its bar: the keyboard goes to the dot that
   * says what stays in view (drag it, or move it with the arrow keys). Absent: no Focus.
   */
  onFocusPoint?: () => void
  onReplace: () => void
  onCopy: () => void
  onReveal: () => void
  onRemove: () => void
  /** Esc: the picture is left (the caret after it). */
  onLeave: () => void
  /**
   * On a slide, the stage's sides: the bar stays between them, moved in from the strip and the divider (the block bar's
   * rule, experience 49).
   */
  bounds?: { left: number; right: number }
  /** A slide-wide place (a side or behind): the bar sits inside it at the bottom, 12 px up, over the picture. */
  inside?: boolean
  /** The document picture's box and its full-width block, which can reserve room for an S bar. */
  documentRow?: { picture: Box; host: HTMLElement }
  /** The bar's own element, so a press on it is never "outside". */
  barRef?: (element: HTMLDivElement | null) => void
}

const SIZE_WORDS: Record<PictureSize, string> = { S: 'Small', M: 'Medium', L: 'Large', Full: 'The full width' }
const ALIGNS: { value: PictureAlign; icon: PhosphorIconName; label: string }[] = [
  { value: 'left', icon: 'text-align-left', label: 'Left' },
  { value: 'center', icon: 'text-align-center', label: 'Centre' },
  { value: 'right', icon: 'text-align-right', label: 'Right' },
]
const PLACES: { value: PicturePlace; icon: PhosphorIconName; mirrored?: boolean; label: string; tip: string }[] = [
  { value: 'text', icon: 'rectangle', label: 'In text', tip: 'In the slide\'s words, where it is' },
  // Phosphor's half square fills its right half: drawn mirrored for Left.
  { value: 'left', icon: 'square-half', mirrored: true, label: 'Left', tip: 'The whole left side of the slide' },
  { value: 'right', icon: 'square-half', label: 'Right', tip: 'The whole right side of the slide' },
  { value: 'behind', icon: 'image', label: 'Behind', tip: 'Behind the slide\'s words' },
]

/** The file manager's name, as VS Code's own Reveal says it. */
export const SHOW_IN_FILES = isMac ? 'Show in Finder' : 'Show in Explorer'

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-hairline" />
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label} className="inline-flex shrink-0 items-center rounded-lg bg-surface-muted p-0.5">{children}</div>
}

function BarButton({ tip, active, onClick, children, disabled, label }: { tip: string; active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; label?: string }) {
  return (
    <Tooltip label={tip} side="bottom">
      <Button
        type="button"
        variant="toolbar"
        size="compact"
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        data-state={active ? 'active' : undefined}
        disabled={disabled}
        className={active ? 'bg-surface shadow-[0_0_0_1px_var(--r-hairline)]' : undefined}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

/** The Description: its words, and whether they show under the picture. */
function DescriptionField({ alt, caption, onWords, withCaption, compact }: { alt: string; caption: boolean; onWords: (alt: string, caption: boolean) => void; withCaption: boolean; compact: boolean }) {
  const [open, setOpen] = useState(false)
  const [words, setWords] = useState(alt)
  const [shown, setShown] = useState(caption)
  const done = () => {
    onWords(words.trim(), shown && !!words.trim())
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (next) {
          setWords(alt)
          setShown(caption)
        }
        setOpen(next)
      }}
    >
      <Tooltip label="The words a screen reader and a published page read">
        <PopoverTrigger asChild>
          <Button type="button" variant="toolbar" size="compact" aria-label="Description" data-state={open ? 'active' : undefined}>
            <Icon name="text-t" size={14} tone="inherit" />
            {compact ? null : 'Description'}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="center" className="w-[300px]" onKeyDown={event => event.stopPropagation()}>
        <form
          className="flex flex-col gap-2.5"
          onSubmit={event => {
            event.preventDefault()
            done()
          }}
        >
          <label className="text-[12.5px] font-semibold text-ink-strong" htmlFor="picture-description">Description</label>
          <Input id="picture-description" autoFocus value={words} placeholder="What the picture shows" onChange={event => setWords(event.target.value)} />
          <p className="m-0 text-[12px] leading-[17px] text-ink-muted">What a screen reader and a published page read.</p>
          {withCaption ? (
            <label className="flex items-center justify-between gap-3 text-[13px] text-ink-body">
              Show it as a caption
              <Switch checked={shown} onCheckedChange={setShown} disabled={!words.trim()} aria-label="Show the description as a caption" />
            </label>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="compact" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="compact">Done</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/**
 * ChatGPT (experience 49): Make a new picture… or Change this picture…, from a description. An empty place has no
 * picture to change, so the item makes a new one at once. Only ChatGPT makes pictures, so it is the only AI named.
 */
function ChatgptItem({ empty, compact, canChange, onChatgpt }: { empty: boolean; compact: boolean; canChange: boolean; onChatgpt: (mode: 'new' | 'change') => void }) {
  const face = (
    <>
      <Icon name="sparkle" size={14} tone="inherit" />
      {compact ? null : 'ChatGPT'}
    </>
  )
  if (empty) {
    return (
      <Tooltip label="Make a new picture with ChatGPT" side="bottom">
        <Button type="button" variant="toolbar" size="compact" aria-label="Make a new picture with ChatGPT" onClick={() => onChatgpt('new')}>
          {face}
        </Button>
      </Tooltip>
    )
  }
  return (
    <DropdownMenu>
      <Tooltip label="Make or change a picture with ChatGPT" side="bottom">
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="toolbar" size="compact" aria-label="ChatGPT">
            {face}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" onCloseAutoFocus={event => event.preventDefault()}>
        {canChange ? <DropdownMenuItem onSelect={() => onChatgpt('change')}>Change this picture…</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={() => onChatgpt('new')}>Make a new picture…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PictureBar(props: PictureBarProps) {
  const { anchor, context, kind, look, alt, canCrop, crop, place, comments, empty } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [top, setTop] = useState(0)
  /**
   * Too wide for the slide's side of the window: words go from the right, one step at a time, their icons and tooltips
   * staying: 1 Description's, 2 Crop's too, 3 the Place items' too (the Experience lead, #774). 0: every word.
   */
  const [fold, setFold] = useState(0)
  const widths = useRef<number[]>([])
  const size = sizeOf(look.width, context)
  const documentRow = anchor && size === 'S' && !crop ? props.documentRow : undefined
  const roomHost = documentRow?.host

  useLayoutEffect(() => {
    return () => { roomHost?.style.removeProperty('--picture-bar-room') }
  }, [roomHost])

  // Centre below the picture by default. An S document bar can sit beside the picture.
  useLayoutEffect(() => {
    const bar = ref.current
    if (!anchor || !bar) return
    const width = bar.offsetWidth
    widths.current[fold] = width
    const room = (props.bounds ? props.bounds.right - props.bounds.left : window.innerWidth) - 16
    if (width > room && fold < 3) {
      setFold(fold + 1)
      return
    }
    if (fold > 0 && widths.current[fold - 1] !== undefined && widths.current[fold - 1] <= room) {
      setFold(fold - 1)
      return
    }
    const height = bar.offsetHeight
    const minX = Math.max(8, (props.bounds?.left ?? 0) + 8)
    const rightEdge = Math.min(window.innerWidth, props.bounds?.right ?? window.innerWidth) - 8
    const maxX = rightEdge - width
    const x = Math.max(minX, Math.min(maxX, anchor.left + anchor.width / 2 - width / 2))
    const placement = pictureBarPlacement(anchor.top + anchor.height, height, window.innerHeight, !!props.inside, documentRow && {
      picture: documentRow.picture,
      width,
      right: Math.min(documentRow.host.getBoundingClientRect().right, rightEdge),
    })
    if (placement.room) roomHost?.style.setProperty('--picture-bar-room', `${placement.room}px`)
    else roomHost?.style.removeProperty('--picture-bar-room')
    setLeft(placement.left ?? Math.round(x))
    setTop(placement.top)
  })

  if (!anchor) return null
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    // A key in the bar's own menu or Description (React hands it on through the portal) is theirs.
    if ((event.target as HTMLElement).closest?.('[data-radix-popper-content-wrapper]')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      if (crop) props.onCropCancel()
      else props.onLeave()
    } else if (event.key === 'Enter' && crop && !(event.target as HTMLElement).closest('input, textarea')) {
      event.preventDefault()
      props.onCropDone()
    }
  }

  const bar = (
    <div
      ref={element => {
        ref.current = element
        props.barRef?.(element)
      }}
      role="toolbar"
      aria-label={crop ? 'Crop the picture' : 'The picture'}
      className="picture-bar fixed z-[60] flex items-center gap-1 rounded-xl bg-surface px-1.5 py-1 font-ui text-ink-strong shadow-[0_0_0_1px_var(--r-hairline),0_10px_28px_-10px_rgba(30,27,75,.3)]"
      style={{ left: left ?? -9999, top }}
      // The picture stays chosen and the caret where it is: a press on the bar never takes the editor's selection.
      onMouseDown={event => { if (!(event.target as HTMLElement).closest('input, textarea')) event.preventDefault() }}
      onKeyDown={keys}
    >
      {crop ? (
        <>
          <span className="px-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-muted">Crop</span>
          <Group label="Shape">
            {CROP_PRESETS.map(preset => (
              <BarButton key={preset.label} tip={preset.ratio ? `A ${preset.ratio} frame` : 'The picture\'s own shape'} active={crop.ratio === preset.ratio} onClick={() => props.onCropShape(preset.ratio)}>
                {preset.label}
              </BarButton>
            ))}
          </Group>
          <Divider />
          <BarButton tip="The whole picture again" onClick={props.onCropReset}>
            <Icon name="arrow-counter-clockwise" size={14} tone="inherit" />
            Reset
          </BarButton>
          <Tooltip label="Keep this crop (Enter)">
            <Button type="button" size="compact" onClick={props.onCropDone}>
              <Icon name="check" size={14} tone="inherit" />
              Done
            </Button>
          </Tooltip>
        </>
      ) : (
        <>
          {kind === 'flow' ? (
            <>
              <Group label="Size">
                {PICTURE_SIZES.map(option => (
                  <BarButton key={option} tip={SIZE_WORDS[option]} active={size === option} onClick={() => props.onSize(option)}>
                    {option}
                  </BarButton>
                ))}
              </Group>
              <Divider />
              {ALIGNS.map(option => (
                <BarButton key={option.value} tip={`Align ${option.label.toLowerCase()}`} label={`Align ${option.label.toLowerCase()}`} active={look.align === option.value} onClick={() => props.onAlign(option.value)}>
                  <Icon name={option.icon} size={14} tone="inherit" />
                </BarButton>
              ))}
              <Divider />
              <BarButton label="Crop" tip={canCrop ? 'Crop the picture: its file stays as it is' : 'The picture is still loading'} disabled={!canCrop} onClick={props.onCrop}>
                <Icon name="crop" size={14} tone="inherit" />
                {fold >= 2 ? null : 'Crop'}
              </BarButton>
            </>
          ) : null}
          {kind === 'side' && !empty && props.onFocusPoint ? (
            <BarButton tip="What stays in view: drag the dot on the picture, or move it with the arrow keys" label="Focus" onClick={props.onFocusPoint}>
              <Icon name="crosshair" size={14} tone="inherit" />
              {fold >= 1 ? null : 'Focus'}
            </BarButton>
          ) : null}
          {context === 'slide' && props.onPlace ? (
            <>
              {kind === 'flow' || (kind === 'side' && !empty && props.onFocusPoint) ? <Divider /> : null}
              <Group label="Place">
                {PLACES.map(option => (
                  <BarButton key={option.value} label={option.label} tip={option.tip} active={place === option.value} onClick={() => props.onPlace?.(option.value)}>
                    <Icon name={option.icon} size={14} tone="inherit" className={option.mirrored ? '-scale-x-100' : undefined} />
                    {fold >= 3 ? null : option.label}
                  </BarButton>
                ))}
              </Group>
            </>
          ) : null}
          {/* With no picture there is nothing to describe: Description is hidden, not greyed. */}
          {empty ? null : (
            <>
              <Divider />
              <DescriptionField alt={alt} caption={!!look.caption} onWords={props.onWords} withCaption={kind === 'flow'} compact={fold >= 1} />
            </>
          )}
          {comments && props.onComment ? (
            <BarButton tip="Comment on the picture, for Claude, ChatGPT or yourself" label="Comment" onClick={props.onComment}>
              <Icon name="chat-text" size={14} tone="inherit" />
            </BarButton>
          ) : null}
          {props.onChatgpt ? <ChatgptItem empty={!!empty} compact={fold >= 1} canChange={props.chatgptCanChange !== false} onChatgpt={props.onChatgpt} /> : null}
          <DropdownMenu>
            <Tooltip label="More">
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="toolbar" size="compact" aria-label="More for the picture">
                  <Icon name="dots-three" size={14} tone="inherit" />
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end" onCloseAutoFocus={event => event.preventDefault()}>
              <DropdownMenuItem onSelect={props.onReplace}>Replace picture…</DropdownMenuItem>
              <DropdownMenuItem disabled={empty} onSelect={props.onCopy}>Copy</DropdownMenuItem>
              <DropdownMenuItem disabled={empty} onSelect={props.onReveal}>{SHOW_IN_FILES}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={empty} onSelect={props.onRemove}>Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
  return createPortal(bar, document.body)
}
