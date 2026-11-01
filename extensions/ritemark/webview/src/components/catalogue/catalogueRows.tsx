/**
 * The control catalogue's rows (Sprint 146, R2): every control in `components/ui/`, each variant a row, each state a
 * cell. Each cell draws its own copy of the control with fixed props, so a state reached in one cell never shows in
 * another. The states and the controls' variants are the Experience lead's (ritemark-dev
 * `releases/v2.2.0/analysis/2026-10-31-sprint-146-experience-answers.md`, section 1).
 *
 * A cell only says which state it shows and where its control is; `scripts/qa/control-states.mjs` reaches the state
 * with real input (`STATE_INPUT` names what it does for each), captures the cell and compares it with the approved
 * image. `catalogueCoverage.test.ts` checks that every exported control has a row.
 */

import type { ReactNode } from 'react'
import { Alert, AlertDescription } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { Dialog, DialogBody, DialogButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, MoreActionsTrigger } from '../ui/dropdown-menu'
import { FilterChip } from '../ui/filter-chip'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Pill } from '../ui/pill'
import { Progress } from '../ui/progress'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select'
import { Slider } from '../ui/slider'
import { SplitButton, type SplitTone } from '../ui/split-button'
import { Switch } from '../ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Textarea } from '../ui/textarea'
import { Tooltip } from '../ui/tooltip'

/** What the script does to reach each state (it lives in `control-states.mjs`; named here so the two agree). */
export const STATE_INPUT = {
  rest: 'nothing: the pointer off every control, the focus nowhere',
  hover: 'the pointer moved onto the control',
  pressed: 'a press held on the control, captured, then released off it',
  focus: "a click on the cell's start mark, then Tab (the keyboard's focus)",
  'focus-caret': "a click on the cell's start mark, then Tab twice (a split button's caret)",
  click: 'a click on the control, then the pointer moved off (the focus with no ring)',
  open: 'a click on the trigger (a right-click for a context menu); the pointer moved off',
  'mouse-pick': 'a click on the trigger, a click on an item, the pointer moved off',
  escape: 'a click on the trigger, the pointer moved off, Escape',
  'key-pick': 'the start mark, Tab, Enter, ↓, Enter',
  'item-hover': 'the menu opened, the pointer on an item',
  'item-key': 'the menu opened by the keyboard (or a right-click), then ↓',
  submenu: 'a right-click, then the pointer on the submenu\'s item',
  'close-hover': "the dialog opened, the pointer on its close",
  'close-focus': "the dialog opened, Tab to its close",
  'button-hover': "the dialog opened, the pointer on one of its buttons",
  'button-focus': "the dialog opened, Tab to one of its buttons",
  disabled: 'nothing (a prop)',
  busy: 'nothing (a prop)',
  on: 'nothing (a prop)',
  filled: 'nothing (a prop)',
  long: 'nothing (a prop)',
  narrow: 'nothing (a prop: a narrow width)',
} as const
export type CatalogueState = keyof typeof STATE_INPUT

export interface CatalogueCell {
  state: CatalogueState
  /** The cell's own name in files, for two cells of one state (a dialog's buttons); the state's when not given. */
  name?: string
  /** The caption over the cell; the name when not given. */
  label?: string
  render: () => ReactNode
  /** The control to act on, inside the cell (default `[data-target]`). */
  target?: string
  /** Tabs from the start mark to the control (default 1), or from the dialog to its control. */
  tabs?: number
  /** The item to act on in an open menu or dialog, in the whole page (default: the menu's first item that is not off). */
  item?: string
  /** The cell's box, in CSS px (default 176 × 72). */
  width?: number
  height?: number
  /** `dialog`: capture the open dialog, not the cell. */
  capture?: 'dialog'
  /** Open by a right-click (a context menu). */
  rightClick?: boolean
  /** The control's distance from the cell's left edge, in CSS px (default 16): room for a tooltip centred on it. */
  inset?: number
  /** `click`: the click opens a list (a Select), and a click outside closes it again. */
  closeOutside?: boolean
}
export interface CatalogueVariant {
  id: string
  label: string
  cells: CatalogueCell[]
}
export interface CatalogueRow {
  id: string
  title: string
  /** The exported components this row shows (`catalogueCoverage.test.ts`). */
  covers: string[]
  variants: CatalogueVariant[]
}

/** Exported parts that need no row of their own: each is drawn by another part, or has no look of its own. */
export const NEEDS_NO_ROW: Record<string, string> = {
  ContextMenuPortal: "the context menu's own portal; ContextMenuContent draws through it",
  DialogPortal: "the dialog's own portal; DialogContent draws through it",
  DialogOverlay: 'the scrim DialogContent draws under every dialog',
  DialogClose: "Radix's close behaviour, with no look of its own (DialogHeader's close draws it)",
}

const MENU_ROOM = 200
const TIP_ROOM = 112
const MENU_WIDTH = 280
const t = (state: CatalogueState, render: () => ReactNode, more: Omit<CatalogueCell, 'state' | 'render'> = {}): CatalogueCell => ({ state, render, ...more })

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'toolbar' | 'link'
const BUTTON_VARIANTS: ButtonVariant[] = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'toolbar', 'link']
function buttonCells(variant: ButtonVariant): CatalogueCell[] {
  const icon = variant === 'link' ? null : <Icon name="chat-circle" size={14} tone="inherit" />
  const b = (props: { disabled?: boolean; label?: string; on?: boolean } = {}) => (
    <Button data-target variant={variant} size="sm" disabled={props.disabled} data-state={props.on ? 'active' : undefined}>
      {icon}{props.label ?? 'Ask Claude'}
    </Button>
  )
  const cells = [
    t('rest', () => b()),
    t('hover', () => b()),
    t('pressed', () => b()),
    t('focus', () => b()),
    t('click', () => b()),
    t('disabled', () => b({ disabled: true })),
    t('long', () => b({ label: 'Ask Claude what is in this folder' }), { width: 300 }),
    t('narrow', () => <div className="rm-cat-narrow" style={{ width: 72 }}>{b({ label: 'Ask Claude what is here' })}</div>),
  ]
  if (variant === 'toolbar') cells.splice(6, 0, t('on', () => b({ on: true })))
  return cells
}
function sizeCells(size: 'sm' | 'lg' | 'icon' | 'icon-sm'): CatalogueCell[] {
  const iconOnly = size === 'icon' || size === 'icon-sm'
  const b = () => (
    <Button data-target variant="outline" size={size} aria-label={iconOnly ? 'Ask Claude' : undefined}>
      <Icon name="chat-circle" size={14} tone="inherit" />{iconOnly ? null : 'Ask Claude'}
    </Button>
  )
  return [t('rest', b), t('hover', b), t('focus', b)]
}

// ── Split button ─────────────────────────────────────────────────────────────
function splitCells(tone: SplitTone): CatalogueCell[] {
  const s = (props: { disabled?: boolean; busy?: boolean; label?: string } = {}) => (
    <SplitButton
      tone={tone}
      disabled={props.disabled}
      busy={props.busy}
      main={{
        label: props.label ?? 'Ask Claude',
        icon: <Icon name={props.busy ? 'circle-notch' : 'chat-circle'} size={14} tone="inherit" />,
        tooltip: 'Ask Claude what is here',
        onClick: () => {},
      }}
      menu={{
        label: 'Ask with',
        tooltip: 'Choose which AI asks',
        content: (
          <>
            <DropdownMenuItem>Claude</DropdownMenuItem>
            <DropdownMenuItem>ChatGPT</DropdownMenuItem>
          </>
        ),
      }}
    />
  )
  const main = '.rm-split-main'
  const caret = '.rm-split-more'
  const room = { width: 240, height: TIP_ROOM }
  return [
    t('rest', () => s(), room),
    t('hover', () => s(), { ...room, target: main }),
    t('pressed', () => s(), { ...room, target: main }),
    t('focus', () => s(), room),
    t('focus-caret', () => s(), { ...room, tabs: 2 }),
    t('click', () => s(), { ...room, target: main }),
    t('open', () => s(), { ...room, target: caret, height: MENU_ROOM }),
    t('mouse-pick', () => s(), { ...room, target: caret }),
    t('escape', () => s(), { ...room, target: caret }),
    t('key-pick', () => s(), { ...room, tabs: 2 }),
    t('disabled', () => s({ disabled: true }), room),
    t('busy', () => s({ busy: true, label: 'Starting…' }), room),
    t('long', () => s({ label: 'Ask Claude what is in this folder' }), { ...room, width: 320 }),
    t('narrow', () => <div className="rm-cat-narrow" style={{ width: 96 }}>{s({ label: 'Ask Claude what is here' })}</div>, room),
  ]
}

// ── Menus ────────────────────────────────────────────────────────────────────
function menuItems(): ReactNode {
  return (
    <>
      <DropdownMenuItem>Rename</DropdownMenuItem>
      <DropdownMenuItem role="menuitemradio" aria-checked>
        <Icon name="check" size={14} tone="inherit" />Shown in Documents
      </DropdownMenuItem>
      <DropdownMenuItem disabled>Move to Ideas</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Delete</DropdownMenuItem>
    </>
  )
}
function dropdown(): ReactNode {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button data-target variant="outline" size="sm">Options<Icon name="caret-down" size={12} tone="inherit" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{menuItems()}</DropdownMenuContent>
    </DropdownMenu>
  )
}
function moreActions(): ReactNode {
  return (
    <DropdownMenu modal={false}>
      <MoreActionsTrigger label="More actions for this card" />
      <DropdownMenuContent align="start">{menuItems()}</DropdownMenuContent>
    </DropdownMenu>
  )
}
const SECOND_ITEM = '[data-radix-popper-content-wrapper] [role^="menuitem"]:nth-of-type(2)'
function contextMenu(): ReactNode {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div data-target className="rm-cat-context">Right-click here</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>This document</ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem>Open<ContextMenuShortcut>⌘O</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem disabled>Move to Ideas</ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem checked>Show in Documents</ContextMenuCheckboxItem>
        <ContextMenuRadioGroup value="list">
          <ContextMenuRadioItem value="list">As a list</ContextMenuRadioItem>
          <ContextMenuRadioItem value="board">As a board</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Share</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Copy as Markdown</ContextMenuItem>
            <ContextMenuItem>Export PDF</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ── Select ───────────────────────────────────────────────────────────────────
function select(props: { disabled?: boolean; long?: boolean } = {}): ReactNode {
  return (
    <Select defaultValue={props.long ? 'long' : 'claude'} disabled={props.disabled}>
      <SelectTrigger data-target aria-label="Model" className="w-[152px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>AIs</SelectLabel>
          <SelectItem value="claude">Claude</SelectItem>
          <SelectItem value="chatgpt">ChatGPT</SelectItem>
          <SelectItem value="long">Claude, the model this project chose</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value="none" disabled>No AI</SelectItem>
      </SelectContent>
    </Select>
  )
}
const NEXT_OPTION = '[role="option"]:not([data-disabled]):not([aria-selected="true"])'

// ── Dialog ───────────────────────────────────────────────────────────────────
function dialog(): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button data-target variant="outline" size="sm">Open the dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader onClose={() => {}}><DialogTitle>Remove this card?</DialogTitle></DialogHeader>
        <DialogBody><DialogDescription>Its file moves to the Trash. Its conversation stays.</DialogDescription></DialogBody>
        <DialogFooter>
          <DialogButton variant="secondary" data-dialog-button="secondary">Cancel</DialogButton>
          <DialogButton variant="danger" data-dialog-button="danger">Remove</DialogButton>
          <DialogButton variant="primary" data-dialog-button="primary">Keep it</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
const inDialog = (selector: string) => `[role="dialog"] ${selector}`

// ── The rows ─────────────────────────────────────────────────────────────────
export const CATALOGUE: CatalogueRow[] = [
  {
    id: 'button',
    title: 'Button',
    covers: ['Button'],
    variants: [
      ...BUTTON_VARIANTS.map((variant) => ({ id: variant, label: variant, cells: buttonCells(variant) })),
      ...(['sm', 'lg', 'icon', 'icon-sm'] as const).map((size) => ({ id: `size-${size}`, label: `size ${size}`, cells: sizeCells(size) })),
    ],
  },
  {
    id: 'split-button',
    title: 'Split button',
    covers: ['SplitButton'],
    variants: (['primary', 'outline', 'quiet'] as SplitTone[]).map((tone) => ({ id: tone, label: tone, cells: splitCells(tone) })),
  },
  {
    id: 'dropdown-menu',
    title: 'Dropdown menu',
    covers: ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuSeparator'],
    variants: [
      {
        id: 'trigger',
        label: 'trigger',
        cells: [
          t('rest', dropdown),
          t('hover', dropdown),
          t('focus', dropdown),
          t('open', dropdown, { width: MENU_WIDTH, height: MENU_ROOM }),
          t('mouse-pick', dropdown),
          t('escape', dropdown),
          t('key-pick', dropdown),
        ],
      },
      {
        id: 'list',
        label: 'list',
        cells: [
          t('item-hover', dropdown, { width: MENU_WIDTH, height: MENU_ROOM, item: SECOND_ITEM }),
          t('item-key', dropdown, { width: MENU_WIDTH, height: MENU_ROOM }),
        ],
      },
    ],
  },
  {
    id: 'more-actions',
    title: 'More actions (…)',
    covers: ['MoreActionsTrigger'],
    variants: [{
      id: 'row',
      label: 'row',
      cells: [
        t('rest', moreActions, { inset: 48 }),
        t('hover', moreActions, { target: 'button', height: TIP_ROOM, inset: 48 }),
        t('focus', moreActions, { height: TIP_ROOM, inset: 48 }),
        t('open', moreActions, { target: 'button', width: MENU_WIDTH, height: MENU_ROOM, inset: 48 }),
        t('mouse-pick', moreActions, { target: 'button', height: TIP_ROOM, inset: 48 }),
        t('escape', moreActions, { target: 'button', height: TIP_ROOM, inset: 48 }),
      ],
    }],
  },
  {
    id: 'context-menu',
    title: 'Context menu',
    covers: [
      'ContextMenu', 'ContextMenuTrigger', 'ContextMenuContent', 'ContextMenuItem', 'ContextMenuCheckboxItem', 'ContextMenuRadioItem',
      'ContextMenuRadioGroup', 'ContextMenuLabel', 'ContextMenuSeparator', 'ContextMenuShortcut', 'ContextMenuGroup', 'ContextMenuSub',
      'ContextMenuSubTrigger', 'ContextMenuSubContent',
    ],
    variants: [{
      id: 'area',
      label: 'area',
      cells: [
        t('open', contextMenu, { width: 340, height: 330, rightClick: true }),
        t('item-hover', contextMenu, { width: 340, height: 330, rightClick: true, item: '[role="menu"] [role="menuitem"]:not([data-disabled])' }),
        t('item-key', contextMenu, { width: 340, height: 330, rightClick: true }),
        t('submenu', contextMenu, { width: 500, height: 330, rightClick: true, item: '[role="menu"] [aria-haspopup="menu"]' }),
      ],
    }],
  },
  {
    id: 'select',
    title: 'Select',
    covers: ['Select', 'SelectGroup', 'SelectValue', 'SelectTrigger', 'SelectContent', 'SelectLabel', 'SelectItem', 'SelectSeparator'],
    variants: [{
      id: 'select',
      label: 'select',
      cells: [
        t('rest', () => select()),
        t('hover', () => select()),
        t('focus', () => select()),
        t('click', () => select(), { closeOutside: true }),
        t('open', () => select(), { width: 300, height: MENU_ROOM }),
        t('mouse-pick', () => select(), { item: NEXT_OPTION }),
        t('escape', () => select()),
        t('key-pick', () => select()),
        t('disabled', () => select({ disabled: true })),
        t('long', () => select({ long: true })),
      ],
    }],
  },
  {
    id: 'switch',
    title: 'Switch',
    covers: ['Switch'],
    variants: (['off', 'on'] as const).map((value) => {
      const sw = (disabled = false) => <Switch data-target aria-label="Show tasks" defaultChecked={value === 'on'} disabled={disabled} />
      return {
        id: value,
        label: value,
        cells: [t('rest', () => sw()), t('hover', () => sw()), t('pressed', () => sw()), t('focus', () => sw()), t('click', () => sw()), t('disabled', () => sw(true))],
      }
    }),
  },
  {
    id: 'tabs',
    title: 'Tabs',
    covers: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
    variants: [{
      id: 'tabs',
      label: 'tabs',
      cells: (['rest', 'hover', 'pressed', 'focus', 'click', 'disabled'] as const).map((state) =>
        t(state, () => (
          <Tabs defaultValue="board">
            <TabsList aria-label="Board views">
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="ideas" data-target disabled={state === 'disabled'}>Ideas</TabsTrigger>
            </TabsList>
            <TabsContent value="board" />
            <TabsContent value="ideas" />
          </Tabs>
        ), { width: 200 })),
    }],
  },
  {
    id: 'filter-chip',
    title: 'Filter chip',
    covers: ['FilterChip'],
    variants: [{
      id: 'chip',
      label: 'chip',
      cells: [
        ...(['rest', 'hover', 'pressed', 'focus', 'click'] as const).map((state) => t(state, () => <FilterChip data-target>Waiting</FilterChip>)),
        t('on', () => <FilterChip data-target selected>Waiting</FilterChip>),
        t('disabled', () => <FilterChip data-target disabled>Waiting</FilterChip>),
        t('long', () => <FilterChip data-target>Waiting for your answer since Monday</FilterChip>, { width: 300 }),
      ],
    }],
  },
  {
    id: 'slider',
    title: 'Slider',
    covers: ['Slider'],
    variants: [{
      id: 'slider',
      label: 'slider',
      cells: (['rest', 'hover', 'pressed', 'focus', 'click', 'disabled'] as const).map((state) =>
        t(state, () => <div className="w-[140px]"><Slider aria-label="Speed" defaultValue={[40]} max={100} step={10} disabled={state === 'disabled'} /></div>, { target: '[role="slider"]' })),
    }],
  },
  ...(['input', 'textarea'] as const).map((kind): CatalogueRow => {
    const field = (props: { disabled?: boolean; value?: string } = {}) => kind === 'input'
      ? <Input data-target aria-label="Title" placeholder="Title" defaultValue={props.value} disabled={props.disabled} className="w-[152px]" />
      : <Textarea data-target aria-label="Notes" placeholder="Notes" defaultValue={props.value} disabled={props.disabled} rows={2} className="w-[152px] resize-none" />
    return {
      id: kind,
      title: kind === 'input' ? 'Input' : 'Textarea',
      covers: [kind === 'input' ? 'Input' : 'Textarea'],
      variants: [{
        id: kind,
        label: kind,
        cells: [
          t('rest', () => field()),
          t('hover', () => field()),
          t('focus', () => field()),
          t('click', () => field()),
          t('filled', () => field({ value: 'Launch plan' })),
          t('disabled', () => field({ disabled: true })),
          t('long', () => field({ value: 'The launch plan for the spring, with its three audiences' })),
        ].map((cell) => ({ ...cell, height: kind === 'textarea' ? 88 : 72 })),
      }],
    }
  }),
  {
    id: 'dialog',
    title: 'Dialog',
    covers: ['Dialog', 'DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogBody', 'DialogFooter', 'DialogTitle', 'DialogDescription', 'DialogButton'],
    variants: [{
      id: 'dialog',
      label: 'dialog',
      cells: [
        t('open', dialog, { capture: 'dialog' }),
        t('close-hover', dialog, { capture: 'dialog', item: inDialog('[aria-label="Close dialog"]') }),
        t('close-focus', dialog, { capture: 'dialog', tabs: 1 }),
        ...(['secondary', 'danger', 'primary'] as const).flatMap((button, index) => [
          t('button-hover', dialog, { name: `${button}-hover`, capture: 'dialog', item: inDialog(`[data-dialog-button="${button}"]`) }),
          t('button-focus', dialog, { name: `${button}-focus`, capture: 'dialog', tabs: 2 + index }),
        ]),
      ],
    }],
  },
  {
    id: 'tooltip',
    title: 'Tooltip',
    covers: ['Tooltip'],
    variants: [{
      id: 'tooltip',
      label: 'tooltip',
      cells: [
        t('hover', () => <Tooltip label="Ask Claude what is here"><Button data-target variant="outline" size="sm">Ask</Button></Tooltip>, { height: TIP_ROOM, width: 240, inset: 88 }),
        t('focus', () => <Tooltip label="Ask Claude what is here"><Button data-target variant="outline" size="sm">Ask</Button></Tooltip>, { height: TIP_ROOM, width: 240, inset: 88 }),
        t('hover', () => (
          <Tooltip label="Ask Claude what is here: it reads the names of the files first, and nothing in the folder is moved or changed">
            <Button data-target variant="outline" size="sm">Ask</Button>
          </Tooltip>
        ), { name: 'long', label: 'long words', height: 150, width: 300, inset: 128 }),
        t('hover', () => (
          <Tooltip label="Sign in to an AI first" className="rm-cat-tip-target">
            <Button variant="outline" size="sm" disabled>Ask</Button>
          </Tooltip>
        ), { name: 'disabled', label: "a disabled button's", target: '.rm-cat-tip-target', height: TIP_ROOM, width: 240, inset: 88 }),
      ],
    }],
  },
  {
    id: 'badge',
    title: 'Badge',
    covers: ['Badge'],
    variants: (['default', 'accent', 'success', 'warning', 'error', 'outline'] as const).map((variant) => ({
      id: variant, label: variant, cells: [t('rest', () => <Badge variant={variant}>3 waiting</Badge>)],
    })),
  },
  {
    id: 'pill',
    title: 'Pill',
    covers: ['Pill'],
    variants: (['default', 'accent', 'info', 'success', 'warning', 'error'] as const).map((variant) => ({
      id: variant, label: variant, cells: [t('rest', () => <Pill variant={variant}>Doing</Pill>)],
    })),
  },
  {
    id: 'alert',
    title: 'Alert',
    covers: ['Alert', 'AlertDescription'],
    variants: (['default', 'destructive'] as const).map((variant) => ({
      id: variant,
      label: variant,
      cells: [t('rest', () => <Alert variant={variant}><AlertDescription>The file could not be read.</AlertDescription></Alert>, { width: 300 })],
    })),
  },
  {
    id: 'label',
    title: 'Label',
    covers: ['Label'],
    variants: [{
      id: 'label',
      label: 'label',
      cells: [
        t('rest', () => <div className="grid gap-1"><Label htmlFor="rm-cat-label-a">Title</Label><Input id="rm-cat-label-a" className="peer w-[152px]" /></div>),
        t('disabled', () => (
          <div className="grid gap-1"><Input id="rm-cat-label-b" disabled className="peer order-2 w-[152px]" /><Label htmlFor="rm-cat-label-b" className="order-1">Title</Label></div>
        )),
      ].map((cell) => ({ ...cell, height: 88 })),
    }],
  },
  {
    id: 'progress',
    title: 'Progress',
    covers: ['Progress'],
    variants: ([['empty', 0], ['partway', 40], ['full', 100]] as const).map(([id, value]) => ({
      id, label: id, cells: [t('rest', () => <div className="w-[140px]"><Progress value={value} /></div>)],
    })),
  },
  {
    id: 'icon',
    title: 'Icon',
    covers: ['Icon'],
    variants: (['muted', 'active', 'disabled', 'inherit'] as const).map((tone) => ({
      id: tone,
      label: tone,
      cells: [t('rest', () => <span className="inline-flex gap-2 text-ink-strong"><Icon name="chat-circle" size={16} tone={tone} /><Icon name="folder-simple" size={16} tone={tone} /><Icon name="check" size={12} tone={tone} /></span>)],
    })),
  },
]

/** A cell's name in files and on the page: `<row>-<variant>-<state>` (its own name when two cells share a state). */
export function cellName(row: CatalogueRow, variant: CatalogueVariant, cell: CatalogueCell): string {
  return `${row.id}-${variant.id}-${cell.name ?? cell.state}`
}
