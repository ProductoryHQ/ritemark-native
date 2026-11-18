/**
 * Sprint 163 (PR 2; decks README "Tabs in the editor", drawn in `tabs-editor.html`): the Tabs block in an editor, the
 * slide's stage and the Text editor alike.
 *
 *  - **The band** is the block's header: one click opens a tab, a double-click renames it (Enter or a click elsewhere
 *    keeps the name, Esc puts the old one back, an empty name isn't kept), a drag sideways moves it (an accent line
 *    shows where it lands), right-click or the small ⌄ on the open tab opens its menu (Rename, Duplicate, Move left,
 *    Move right, Delete tab), and + at the band's end adds a tab with its name chosen. The arrow keys move between the
 *    tabs (a tablist), Enter or F2 renames, ↓ goes into the pane.
 *  - **The panes** are the editor's own content, every one in the block, only the open one shown (`data-active`, as the
 *    renderer marks it): on a slide they stand in one place (the block as tall as its tallest tab), in a Text document
 *    the open one alone. The caret going into a pane (an undo, a search) opens its tab.
 *  - The band is drawn by React (shadcn's menus, `ui/tooltip.tsx`) in a root of its own inside the node view, which
 *    ProseMirror never reads (`ignoreMutation`, `stopEvent`); every change it makes is a transaction (`tabsCommands`).
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Selection, type Transaction } from '@tiptap/pm/state'
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { Icon, type PhosphorIconName } from '../../components/ui/Icon'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../../components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu'
import { TabPane, TabsBlock, tabNameOf } from './tabsMarkdown'
import { addTab, deleteTab, duplicateTab, moveTab, panePos, renameTab, setPendingRename, takePendingRename } from './tabsCommands'

export type TabsVariant = 'slide' | 'text'

/** What a tab's menu does. */
type TabAction = 'rename' | 'duplicate' | 'left' | 'right' | 'delete'

interface BandProps {
  names: string[]
  active: number
  renaming: number | null
  /** The band's tabs take the keyboard's focus after a change made from the keys (the arrows). */
  focusActive: number
  onPick: (index: number) => void
  onRenameStart: (index: number) => void
  onRenameEnd: (index: number, name: string | null, how: 'enter' | 'blur' | 'escape') => void
  onAction: (action: TabAction, index: number) => void
  onAdd: () => void
  onMove: (from: number, to: number) => void
  onEnterPane: () => void
}

const MENU: Array<{ action: TabAction; label: string; icon: PhosphorIconName; hint?: string }> = [
  { action: 'rename', label: 'Rename', icon: 'pencil-simple', hint: 'Double-click' },
  { action: 'duplicate', label: 'Duplicate', icon: 'copy-simple' },
  { action: 'left', label: 'Move left', icon: 'arrow-left' },
  { action: 'right', label: 'Move right', icon: 'arrow-right' },
]

/** The tab's menu items, for the right-click menu and the ⌄ alike. */
function MenuItems({ index, count, onAction, kind }: { index: number; count: number; onAction: (action: TabAction, index: number) => void; kind: 'context' | 'dropdown' }) {
  const Item = kind === 'context' ? ContextMenuItem : DropdownMenuItem
  const Separator = kind === 'context' ? ContextMenuSeparator : DropdownMenuSeparator
  return (
    <>
      {MENU.map(entry => (
        <Item
          key={entry.action}
          className="gap-2"
          disabled={(entry.action === 'left' && index === 0) || (entry.action === 'right' && index === count - 1)}
          onSelect={() => onAction(entry.action, index)}
        >
          <Icon name={entry.icon} size={16} tone="inherit" />
          <span className="flex-1">{entry.label}</span>
          {entry.hint ? <span className="blk-tabmenu-hint">{entry.hint}</span> : null}
        </Item>
      ))}
      <Separator />
      <Item className="gap-2 blk-tabmenu-danger" onSelect={() => onAction('delete', index)}>
        <Icon name="trash" size={16} tone="inherit" />
        <span className="flex-1">Delete tab</span>
      </Item>
    </>
  )
}

/** The name being typed in place of the tab's words. */
function RenameField({ name, onEnd }: { name: string; onEnd: (name: string | null, how: 'enter' | 'blur' | 'escape') => void }) {
  const [value, setValue] = useState(name)
  const ref = useRef<HTMLInputElement | null>(null)
  const ended = useRef(false)
  useLayoutEffect(() => {
    const input = ref.current
    if (!input) return
    // After the menu that asked for it gives the focus back (Radix), so the name stays chosen for typing.
    const frame = requestAnimationFrame(() => { input.focus(); input.select() })
    input.focus()
    input.select()
    return () => cancelAnimationFrame(frame)
  }, [])
  const end = (how: 'enter' | 'blur' | 'escape') => {
    if (ended.current) return
    ended.current = true
    onEnd(how === 'escape' ? null : value, how)
  }
  return (
    <input
      ref={ref}
      className="blk-tab-input"
      value={value}
      size={Math.max(6, value.length + 1)}
      aria-label="Tab name"
      spellCheck={false}
      onChange={event => setValue(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); end('enter') }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); end('escape') }
      }}
      onBlur={() => end('blur')}
    />
  )
}

function TabBand({ names, active, renaming, focusActive, onPick, onRenameStart, onRenameEnd, onAction, onAdd, onMove, onEnterPane }: BandProps) {
  const tabs = useRef<Array<HTMLDivElement | null>>([])
  const [drop, setDrop] = useState<{ left: number; top: number; height: number } | null>(null)
  const [lifted, setLifted] = useState<number | null>(null)
  const dragged = useRef(false)
  const [menuFor, setMenuFor] = useState<number | null>(null)

  useEffect(() => {
    if (focusActive > 0) tabs.current[active]?.focus()
  }, [focusActive, active])

  // A drag sideways moves the tab; a line in the accent shows where it lands. A press that doesn't move is a click.
  const startDrag = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || renaming !== null || (event.target as HTMLElement).closest('.blk-tab-dd')) return
    const band = event.currentTarget.parentElement
    if (!band) return
    const startX = event.clientX
    dragged.current = false
    let to = index
    const onMovePointer = (move: PointerEvent) => {
      if (!dragged.current && Math.abs(move.clientX - startX) < 5) return
      dragged.current = true
      setLifted(index)
      const rects = tabs.current.slice(0, names.length).map(tab => tab?.getBoundingClientRect() ?? null)
      to = rects.length
      for (let at = 0; at < rects.length; at++) {
        const rect = rects[at]
        if (rect && move.clientX < rect.left + rect.width / 2) { to = at; break }
      }
      const origin = band.getBoundingClientRect()
      const scale = band.offsetWidth ? origin.width / band.offsetWidth : 1
      const edge = to < rects.length ? rects[to]!.left - 1 : rects[rects.length - 1]!.right + 1
      const first = rects[0]!
      setDrop({ left: (edge - origin.left) / scale - 1, top: (first.top - origin.top) / scale + 4, height: first.height / scale - 8 })
    }
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', onMovePointer)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey, true)
      setDrop(null)
      setLifted(null)
      if (commit && dragged.current) {
        const target = to > index ? to - 1 : to
        if (target !== index) onMove(index, target)
      }
    }
    const onUp = () => finish(true)
    const onKey = (key: KeyboardEvent) => { if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); dragged.current = false; finish(false) } }
    window.addEventListener('pointermove', onMovePointer)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey, true)
  }

  const onKeyDown = (index: number) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      onPick((index + (event.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      onPick(event.key === 'Home' ? 0 : names.length - 1)
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      onRenameStart(index)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onEnterPane()
    }
  }

  return (
    <>
      {names.map((name, index) => {
        const open = index === active
        if (index === renaming) {
          return (
            <div key={`r${index}`} className="blk-tab is-active is-renaming" role="tab" aria-selected={open}>
              <RenameField name={name} onEnd={(next, how) => onRenameEnd(index, next, how)} />
            </div>
          )
        }
        return (
          <ContextMenu key={index} modal={false}>
            <ContextMenuTrigger asChild>
              <div
                ref={element => { tabs.current[index] = element }}
                className={`blk-tab${open ? ' is-active' : ''}${lifted === index ? ' is-lifted' : ''}${menuFor === index ? ' has-menu' : ''}`}
                role="tab"
                aria-selected={open}
                tabIndex={open ? 0 : -1}
                onPointerDown={startDrag(index)}
                onMouseDown={event => { if (event.button === 0 && !(event.target as HTMLElement).closest('.blk-tab-dd')) event.preventDefault() }}
                onClick={event => {
                  if ((event.target as HTMLElement).closest('.blk-tab-dd')) return
                  if (dragged.current) { dragged.current = false; return }
                  onPick(index)
                }}
                onDoubleClick={event => { if (!(event.target as HTMLElement).closest('.blk-tab-dd')) onRenameStart(index) }}
                onContextMenu={event => { event.stopPropagation(); onPick(index) }}
                onKeyDown={onKeyDown(index)}
              >
                <span className="blk-tab-words">{name}</span>
                {open ? (
                  <DropdownMenu modal={false} open={menuFor === index} onOpenChange={next => setMenuFor(next ? index : null)}>
                    <Tooltip label="This tab's menu">
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="blk-tab-dd" aria-label={`${name}: the tab's menu`} tabIndex={-1} onMouseDown={event => event.preventDefault()}>
                          <Icon name="caret-down" size={12} tone="inherit" />
                        </Button>
                      </DropdownMenuTrigger>
                    </Tooltip>
                    <DropdownMenuContent align="start" onCloseAutoFocus={event => event.preventDefault()}>
                      <MenuItems index={index} count={names.length} onAction={onAction} kind="dropdown" />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent onCloseAutoFocus={event => event.preventDefault()}>
              <MenuItems index={index} count={names.length} onAction={onAction} kind="context" />
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
      <Tooltip label="Add a tab">
        <Button variant="ghost" className="blk-tab-add" aria-label="Add a tab" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={onAdd}>
          <Icon name="plus" size={12} tone="inherit" />
        </Button>
      </Tooltip>
      {drop ? <span className="blk-tab-drop" style={{ left: drop.left, top: drop.top, height: drop.height }} aria-hidden="true" /> : null}
    </>
  )
}

/** Dispatch a change from the band, with a tab to rename once the band draws again. */
function run(view: EditorView, tr: Transaction | null, rename?: { pos: number; index: number }): boolean {
  if (!tr) return false
  if (rename) setPendingRename(view, rename.pos, rename.index)
  view.dispatch(tr)
  return true
}

class TabsNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private readonly band: HTMLElement
  private readonly root: Root
  private active = 0
  private renaming: number | null = null
  private focusActive = 0
  private destroyed = false

  constructor(
    private node: PMNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly editor: Editor,
    variant: TabsVariant,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = variant === 'text' ? 'blk-tabs is-text' : 'blk-tabs'
    this.dom.setAttribute('data-tabs', '')
    this.band = document.createElement('div')
    this.band.className = 'blk-tabbar'
    this.band.setAttribute('role', 'tablist')
    this.band.setAttribute('aria-label', 'Tabs')
    this.band.contentEditable = 'false'
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'blk-tabpanes'
    this.dom.append(this.band, this.contentDOM)
    // The names as plain words until React's first draw replaces them (no empty band for a frame).
    for (const name of this.names()) {
      const tab = document.createElement('span')
      tab.className = 'blk-tab'
      tab.textContent = name
      this.band.append(tab)
    }
    this.root = createRoot(this.band)
    this.takeRename()
    this.editor.on('selectionUpdate', this.follow)
    this.render()
  }

  private names(): string[] {
    const names: string[] = []
    this.node.forEach(pane => names.push(tabNameOf(pane.attrs.line)))
    return names
  }

  private pos(): number | null {
    const pos = this.getPos()
    return typeof pos === 'number' ? pos : null
  }

  /** A tab made to be named now (a new block's first, a new one). */
  private takeRename() {
    const pos = this.pos()
    if (pos === null) return
    const index = takePendingRename(this.view, pos)
    if (index !== null && index < this.node.childCount) {
      this.active = index
      this.renaming = index
    }
  }

  /** The caret going into a pane (an undo, a search, the arrows) opens its tab. */
  private follow = () => {
    const pos = this.pos()
    if (pos === null || this.destroyed) return
    const $head = this.view.state.selection.$head
    if ($head.pos <= pos || $head.pos >= pos + this.node.nodeSize) return
    for (let depth = $head.depth; depth > 0; depth--) {
      if ($head.before(depth) === pos && depth < $head.depth) {
        const index = $head.index(depth)
        if (index !== this.active && index < this.node.childCount) {
          this.active = index
          this.render()
        }
        return
      }
    }
  }

  private render() {
    if (this.destroyed) return
    const count = this.node.childCount
    if (this.active >= count) this.active = Math.max(0, count - 1)
    this.dom.setAttribute('data-active', String(this.active))
    this.root.render(
      <TabBand
        names={this.names()}
        active={this.active}
        renaming={this.renaming}
        focusActive={this.focusActive}
        onPick={this.pick}
        onRenameStart={this.startRename}
        onRenameEnd={this.endRename}
        onAction={this.act}
        onAdd={this.add}
        onMove={this.move}
        onEnterPane={() => this.intoPane(this.active, true)}
      />,
    )
  }

  /** The caret at the start of pane `index`, the editor focused when asked. */
  private intoPane(index: number, focus: boolean) {
    const pos = this.pos()
    if (pos === null) return
    const start = panePos(this.node, pos, index)
    const selection = Selection.findFrom(this.view.state.doc.resolve(start + 1), 1, true)
    if (selection) this.view.dispatch(this.view.state.tr.setSelection(selection))
    if (focus) this.view.focus()
  }

  private pick = (index: number) => {
    const keyboard = this.band.contains(document.activeElement)
    this.active = index
    if (keyboard) this.focusActive++
    // The caret goes into the open pane, so it is where the next words go and nothing else opens another tab.
    this.intoPane(index, false)
    this.render()
  }

  private startRename = (index: number) => {
    this.active = index
    this.renaming = index
    this.render()
  }

  private endRename = (index: number, name: string | null, how: 'enter' | 'blur' | 'escape') => {
    this.renaming = null
    const pos = this.pos()
    if (pos !== null && name !== null) run(this.view, renameTab(this.view.state, pos, index, name))
    this.render()
    // Enter goes into the pane (a new block: its name typed, then its words); Esc back to the tab.
    if (how === 'enter') this.intoPane(index, true)
    else if (how === 'escape') { this.focusActive++; this.render() }
  }

  private add = () => {
    const pos = this.pos()
    if (pos === null) return
    const made = addTab(this.view.state, pos)
    if (made) run(this.view, made.tr, { pos, index: made.index })
  }

  private move = (from: number, to: number) => {
    const pos = this.pos()
    if (pos === null) return
    if (run(this.view, moveTab(this.view.state, pos, from, to))) {
      this.active = to
      this.render()
    }
  }

  private act = (action: TabAction, index: number) => {
    const pos = this.pos()
    if (pos === null) return
    const state = this.view.state
    if (action === 'rename') { this.startRename(index); return }
    if (action === 'duplicate') { if (run(this.view, duplicateTab(state, pos, index))) { this.active = index + 1; this.render() } return }
    if (action === 'left' || action === 'right') { this.move(index, action === 'left' ? index - 1 : index + 1); return }
    if (action === 'delete') {
      run(this.view, deleteTab(state, pos, index))
      this.view.focus()
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.takeRename()
    this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    // The band's clicks, keys and drags are its own, never the editor's.
    return this.band.contains(event.target as globalThis.Node)
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return this.band.contains(mutation.target as globalThis.Node)
    if (mutation.type === 'attributes' && mutation.target === this.dom) return true
    return this.band.contains(mutation.target as globalThis.Node)
  }

  destroy() {
    this.destroyed = true
    this.editor.off('selectionUpdate', this.follow)
    const root = this.root
    // Never while React draws (a node view may go in the middle of an editor's own render).
    queueMicrotask(() => root.unmount())
  }
}

/** A pane: the editor's own blocks, a tab panel named by its tab. */
class TabPaneView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  constructor(node: PMNode) {
    this.dom = document.createElement('div')
    this.dom.className = 'blk-tabpane'
    this.dom.setAttribute('role', 'tabpanel')
    this.dom.setAttribute('data-tab', '')
    this.contentDOM = this.dom
    this.name(node)
  }

  private name(node: PMNode) {
    this.dom.setAttribute('aria-label', tabNameOf(node.attrs.line))
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'tabPane') return false
    this.name(node)
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.type === 'attributes' && mutation.target === this.dom
  }
}

/** The Tabs block's two nodes with their views: the slide's stage passes `slide`, the Text editor `text`. */
export function tabsWithViews(variant: TabsVariant) {
  return [
    TabsBlock.extend({
      addNodeView() {
        return ({ node, getPos, editor }) => new TabsNodeView(node, editor.view, getPos as () => number | undefined, editor, variant)
      },
    }),
    TabPane.extend({
      addNodeView() {
        return ({ node }) => new TabPaneView(node)
      },
    }),
  ]
}

/** A new Tabs block was put in: its first tab's name is chosen for typing (README "Adding it"). */
export function nameNewTabs(view: EditorView, pos: number): void {
  setPendingRename(view, pos, 0)
}
