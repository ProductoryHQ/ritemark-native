/**
 * Sprint 167 PR 5 (decks README item B): one item's own handle on the chosen block, in the block bar's layer over the
 * slide (`SlideBlockBar` places it, `itemHandle.ts` does the work). The shape is the Text editor's table grip: a
 * column's pill on a box's or a column's top edge, a row's on a step's or a list item's left edge, white like the
 * block's other handles. A click opens its menu under it: Duplicate, Move left and Move right (or Move up and Move
 * down), then Delete box (column, step, item). A drag moves the item, with a line where it lands; Esc puts it back.
 * A press on it never takes the caret off the slide, and it sits where no words are, so it takes no word's click.
 */
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { Button } from '../../ui/button'
import { Tooltip } from '../../ui/tooltip'
import { Icon, type PhosphorIconName } from '../../ui/Icon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { cn } from '../../../lib/utils'
import type { Box, ChosenBlock } from './blockBar'
import {
  ITEM_WORD, canDuplicateItem, deleteItem, duplicateItem, itemDropLine, itemGripSpot, itemGripTip, itemKindOf, itemRuns, moveItem, type DropLine, type PlacedItem,
} from './itemHandle'

/** How far a press moves before it is a drag (the table grip's). */
const DRAG_THRESHOLD = 4

const ITEM_CLASS = 'gap-2.5 text-[13px] [&_svg]:shrink-0'
const DANGER = 'text-[var(--r-error)] focus:text-[var(--r-error)] [&_svg]:text-[var(--r-error)]'

export interface SlideItemHandleProps {
  editor: TipTapEditor
  frame: HTMLDivElement
  chosen: ChosenBlock
  block: Box
  items: PlacedItem[]
  /** The item the handle is on (the pointer's, else the caret's), or null. */
  index: number | null
  /** Another handle drags: this one hides, as the bar's do. */
  hidden: boolean
  /** The item's menu, open on an item (its index), or null. */
  menuAt: number | null
  onMenu: (index: number | null) => void
  /** While it drags: the line where the item lands (null where it would stay); `false` once the drag ends. */
  onDrag: (state: { from: number; line: DropLine | null } | false) => void
  /** Run a change on the chosen block as it is now (`SlideBlockBar`'s `act`), then focus the slide again. */
  run: (make: (pos: number) => Transaction | null) => void
}

export function SlideItemHandle({ editor, frame, chosen, block, items, index, hidden, menuAt, onMenu, onDrag, run }: SlideItemHandleProps) {
  const kind = itemKindOf(chosen.kind)
  const press = useRef<{ from: number; x: number; y: number; moved: boolean; line: DropLine | null; doc: unknown } | null>(null)
  const [pressing, setPressing] = useState(false)
  // The drag's Esc listener, as it was added (a render during the drag makes new functions).
  const keyRef = useRef<((key: KeyboardEvent) => void) | null>(null)
  const at = menuAt ?? index
  if (!kind || at === null || !items[at]) return null
  const item = items[at]
  const spot = itemGripSpot(kind, item, block, chosen.kind)
  const runs = itemRuns(kind)
  const word = ITEM_WORD[kind]
  const count = items.length

  const end = () => {
    if (keyRef.current) window.removeEventListener('keydown', keyRef.current, true)
    keyRef.current = null
    press.current = null
    setPressing(false)
    onDrag(false)
  }
  const onKey = (key: KeyboardEvent) => {
    if (key.key !== 'Escape' || !press.current?.moved) return
    key.preventDefault()
    key.stopPropagation()
    end()
  }
  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { from: at, x: event.clientX, y: event.clientY, moved: false, line: null, doc: editor.state.doc }
    setPressing(true)
    keyRef.current = onKey
    window.addEventListener('keydown', onKey, true)
  }
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = press.current
    if (!current) return
    // The button is no longer down (its release went elsewhere): the drag ends here, moving nothing.
    if ((event.buttons & 1) === 0) { end(); return }
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD) return
    if (!current.moved) onMenu(null)
    const origin = frame.getBoundingClientRect()
    current.moved = true
    current.line = itemDropLine(items, runs, current.from, event.clientX - origin.left, event.clientY - origin.top)
    onDrag({ from: current.from, line: current.line })
  }
  const up = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = press.current
    if (!current) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    end()
    if (!current.moved) { onMenu(menuAt === current.from ? null : current.from); return }
    // A drop on a document that changed meanwhile is no drop: the places were read from the one before.
    if (current.line && editor.state.doc === current.doc) run(pos => moveItem(editor.state, pos, current.from, current.line!.to))
  }

  const style: CSSProperties = { left: spot.left, top: spot.top, width: spot.width, height: spot.height, zIndex: 6, ...(hidden ? { visibility: 'hidden' } : {}) }
  const anchor = frame.getBoundingClientRect()
  const act = (make: (pos: number) => Transaction | null) => { onMenu(null); run(make) }
  const entry = (icon: PhosphorIconName, label: string, make: (pos: number) => Transaction | null, options: { disabled?: boolean; danger?: boolean } = {}) => (
    <DropdownMenuItem key={label} className={cn(ITEM_CLASS, options.danger && DANGER)} disabled={options.disabled} onSelect={() => act(make)}>
      <Icon name={icon} size={14} tone="inherit" />
      {label}
    </DropdownMenuItem>
  )
  const before = runs === 'row' ? 'Move left' : 'Move up'
  const afterward = runs === 'row' ? 'Move right' : 'Move down'

  return (
    <>
      <div className="deck-block-at" style={style}>
        <Tooltip label={itemGripTip(kind)} className="size-full" side={runs === 'row' ? 'top' : 'left'} suppressed={pressing || menuAt !== null || hidden}>
          <Button
            type="button"
            variant="ghost"
            className={cn('deck-item-grip', runs === 'row' ? 'is-column' : 'is-row', menuAt === at && 'is-on')}
            aria-label={`${word[0].toUpperCase()}${word.slice(1)} ${at + 1}: menu, or drag to move`}
            aria-haspopup="menu"
            aria-expanded={menuAt === at}
            onPointerDown={down}
            onMouseDown={event => event.preventDefault()}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={end}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onMenu(menuAt === at ? null : at)
            }}
          >
            <Icon name={runs === 'row' ? 'dots-six' : 'dots-six-vertical'} size={12} tone="inherit" />
          </Button>
        </Tooltip>
      </div>
      {menuAt === at ? (
        <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onMenu(null) }}>
          {createPortal(
            <DropdownMenuTrigger asChild>
              <span
                aria-hidden="true"
                className="rm-table-menu-anchor"
                style={{ left: anchor.left + spot.left, top: anchor.top + spot.top, width: spot.width, height: spot.height }}
              />
            </DropdownMenuTrigger>,
            document.body,
          )}
          <DropdownMenuContent align="start" side="bottom" className="w-[200px] max-w-none" onCloseAutoFocus={event => { event.preventDefault(); editor.view.focus() }}>
            {entry('copy', 'Duplicate', pos => duplicateItem(editor.state, pos, at), { disabled: !canDuplicateItem(chosen) })}
            {entry(runs === 'row' ? 'arrow-left' : 'arrow-up', before, pos => moveItem(editor.state, pos, at, at - 1), { disabled: at === 0 })}
            {entry(runs === 'row' ? 'arrow-right' : 'arrow-down', afterward, pos => moveItem(editor.state, pos, at, at + 1), { disabled: at === count - 1 })}
            <DropdownMenuSeparator />
            {entry('trash', `Delete ${word}`, pos => deleteItem(editor.state, pos, at), { danger: true })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )
}
