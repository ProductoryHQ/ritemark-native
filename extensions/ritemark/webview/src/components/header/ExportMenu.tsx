/**
 * Share (Sprint 134, R12): 1.x's Export menu, as experience 26's frame 1 draws
 * it. Send a copy (PDF, Word document), Google Docs, Copy as Markdown, and the
 * foot line; the items and their handlers come from `shareMenu.ts`.
 *
 * Built from the menu family in `ui/dropdown-menu.tsx`, styled to the kit's
 * `.menu.share` (300 wide, 10 radius, 6 padding; 32 rows, 44 with a second
 * line; uppercase group titles). Keyboard support is Radix's: Enter on Share
 * opens it with the first item focused, arrows and Home/End move, typing jumps
 * to an item, Escape and Tab close it and return focus to Share.
 *
 * App owns whether the menu is open and the Share button lives in
 * DocumentHeader, so the menu is anchored to a stand-in laid over the button
 * (right-aligned, 6 below it, as drawn). Without a button (File ▸ Share on a
 * page with no document bar) it opens at the top right.
 */
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import type { GoogleDocsAction, GoogleDocsProjection } from './googleDocsMenu'
import { SHARE_BUTTON_ATTRIBUTE, runShareItem, shareMenuModel, type ShareMenuItem } from './shareMenu'

interface ShareMenuProps {
  isOpen: boolean
  onClose: () => void
  onExportPDF: (templateId?: string) => void
  onExportWord: (templateId?: string) => void
  onCopyAsMarkdown: () => void
  /** The Share button; when null, the one in the document's bar is found by its attribute. */
  anchorElement: HTMLElement | null
  /** Host projection for Google Docs publishing; null hides the group. */
  googleDocs?: GoogleDocsProjection | null
  onGoogleDocsAction?: (action: GoogleDocsAction) => void
}

/** The stand-in's place: fixed, measured from the window's right edge, so it stays under Share as the window resizes. */
interface AnchorBox {
  top: number
  right: number
  width: number
  height: number
}

const COPIED_MS = 2000

function measureAnchor(anchor: HTMLElement | null): AnchorBox {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  if (!anchor) return { top: 4, right: 4, width: 0, height: 32 }
  const rect = anchor.getBoundingClientRect()
  return { top: rect.top, right: viewportWidth - rect.right, width: rect.width, height: rect.height }
}

export function ShareMenu({
  isOpen,
  onClose,
  onExportPDF,
  onExportWord,
  onCopyAsMarkdown,
  anchorElement,
  googleDocs = null,
  onGoogleDocsAction,
}: ShareMenuProps) {
  const anchorRef = useRef<HTMLElement | null>(null)
  const leftOutsideRef = useRef(false)
  // Focus goes back to Share when the keyboard closed the menu. After a click
  // on an item it does not, or Share's tooltip would show over the bar.
  const lastInputRef = useRef<'keyboard' | 'pointer'>('keyboard')
  const copiedTimerRef = useRef<number | undefined>(undefined)
  const [box, setBox] = useState<AnchorBox | null>(null)
  const [copied, setCopied] = useState(false)
  const groupIdPrefix = useId()

  useLayoutEffect(() => {
    if (!isOpen) {
      setBox(null)
      return
    }
    const anchor = anchorElement ?? document.querySelector<HTMLElement>(`[${SHARE_BUTTON_ATTRIBUTE}]`)
    anchorRef.current = anchor
    leftOutsideRef.current = false
    lastInputRef.current = 'keyboard'
    const update = () => setBox(measureAnchor(anchor))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isOpen, anchorElement])

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), [])

  const handleSelect = useCallback((event: Event, item: ShareMenuItem) => {
    if (!item.run) {
      event.preventDefault()
      return
    }
    if (item.run.kind === 'markdown') {
      // As Export did: the menu stays open and says Copied for a moment.
      event.preventDefault()
      onCopyAsMarkdown()
      setCopied(true)
      window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), COPIED_MS)
      return
    }
    runShareItem(item.run, { onExportPDF, onExportWord, onCopyAsMarkdown, onGoogleDocsAction })
  }, [onExportPDF, onExportWord, onCopyAsMarkdown, onGoogleDocsAction])

  const model = shareMenuModel(googleDocs, { googleDocs: Boolean(onGoogleDocsAction) })
  const standInStyle: CSSProperties | undefined = box
    ? { position: 'fixed', top: box.top, right: box.right, width: box.width, height: box.height }
    : undefined

  return (
    <DropdownMenu modal={false} open={isOpen && box !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden="true" className="pointer-events-none invisible fixed" style={standInStyle} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={4} /* Share sits 4 from the desk's edge; the menu's right edge stays level with it */
        aria-labelledby={undefined}
        aria-label="Share"
        className="w-[300px] max-w-[calc(100vw-16px)] rounded-lg border-0 p-1.5 text-[13px] leading-5 shadow-[0_0_0_1px_var(--r-hairline),0_10px_24px_-6px_rgba(30,27,75,0.16),0_4px_8px_-4px_rgba(30,27,75,0.08)]"
        onInteractOutside={(event) => {
          // A press on Share itself is App's toggle, which closes the menu; anything else closes it here.
          const target = event.target as Node | null
          if (target && anchorRef.current?.contains(target)) {
            event.preventDefault()
            return
          }
          leftOutsideRef.current = true
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (!leftOutsideRef.current && lastInputRef.current === 'keyboard') anchorRef.current?.focus()
          leftOutsideRef.current = false
        }}
        onPointerDown={() => { lastInputRef.current = 'pointer' }}
        onKeyDown={(event) => {
          lastInputRef.current = 'keyboard'
          if (event.key === 'Tab') {
            event.preventDefault()
            onClose()
          }
        }}
      >
        {model.groups.map((group, index) => {
          const titleId = `${groupIdPrefix}-${group.id}`
          return (
            <Fragment key={group.id}>
              {index > 0 && <DropdownMenuSeparator className="mx-1 my-1.5" />}
              <DropdownMenuPrimitive.Group aria-labelledby={group.title ? titleId : undefined}>
                {group.title && (
                  <DropdownMenuPrimitive.Label
                    id={titleId}
                    className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.5px] text-ink-muted"
                  >
                    {group.title}
                  </DropdownMenuPrimitive.Label>
                )}
                {group.items.map((item) => (
                  <ShareMenuRow
                    key={item.id}
                    item={item}
                    copied={copied && item.run?.kind === 'markdown'}
                    onSelect={handleSelect}
                  />
                ))}
              </DropdownMenuPrimitive.Group>
            </Fragment>
          )
        })}

        <div className="mt-1.5 flex gap-2 border-t border-hairline px-2.5 pb-1 pt-2 text-[12px] leading-[17px] text-ink-muted">
          <Icon name="info" size={12} tone="inherit" className="mt-[2.5px] shrink-0" />
          <span>{model.foot}</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ShareMenuRow({
  item,
  copied,
  onSelect,
}: {
  item: ShareMenuItem
  copied: boolean
  onSelect: (event: Event, item: ShareMenuItem) => void
}) {
  const twoLines = Boolean(item.detail) && !item.detailBeside
  const label = copied ? 'Copied' : item.label
  return (
    <DropdownMenuItem
      disabled={item.disabled}
      textValue={item.label}
      aria-busy={item.busy || undefined}
      onSelect={(event) => onSelect(event, item)}
      className={cn(
        'gap-2.5 rounded-md px-2.5 py-0 leading-4 focus:bg-accent-soft data-[disabled]:text-ink-muted data-[disabled]:opacity-100',
        twoLines ? 'h-11' : 'h-8',
        copied && 'text-[var(--r-success)] focus:text-[var(--r-success)]',
      )}
    >
      <Icon
        name={copied ? 'check' : item.icon}
        size={14}
        tone="inherit"
        className={cn(copied ? 'text-[var(--r-success)]' : 'text-ink-muted', item.busy && 'animate-spin')}
      />
      {twoLines ? (
        <span className="grid min-w-0">
          <span className="truncate">{label}</span>
          <span className="truncate text-[12px] text-ink-muted">{item.detail}</span>
        </span>
      ) : (
        <>
          <span className="truncate">{label}</span>
          {item.detail && !copied && (
            <span className="ml-auto shrink-0 pl-4 text-[12px] text-ink-muted">{item.detail}</span>
          )}
        </>
      )}
    </DropdownMenuItem>
  )
}

/** 1.x's name, which App.tsx still imports. */
export const ExportMenu = ShareMenu
