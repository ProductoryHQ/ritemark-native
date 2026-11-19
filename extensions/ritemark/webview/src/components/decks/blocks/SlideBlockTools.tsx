/**
 * Sprint 161 (PR 3): the slide editor's small tools that open from a block on the slide.
 *
 *  - `SlideIconPicker`: a box's icon, chosen from the grid of 24 with No icon under it (README frame 4), opened under
 *    the icon the person clicked. The menu sits in `document.body`, outside the scaled slide, at its own size.
 *  - `WebPageDialog`: the / menu's Web page asks for the page's address and puts it on the slide as a link (no live
 *    page is drawn: the sprint plan's "same place as a Picture with a link").
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Dialog, DialogBody, DialogButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Icon } from '../../ui/Icon'
import { Input } from '../../ui/input'
import { IconGridItems } from '../slide/IconGrid'

/** Where the picker opens, and for which box. */
export interface IconPick {
  pos: number
  rect: { left: number; top: number; width: number; height: number }
  current: string | null
}

export function SlideIconPicker({ pick, onPick, onClose }: { pick: IconPick | null; onPick: (pos: number, name: string | null) => void; onClose: () => void }) {
  if (!pick) return null
  return createPortal(
    <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose() }}>
      <DropdownMenuTrigger asChild>
        {/* The icon's place on the screen: the menu opens under it. */}
        <span
          aria-hidden="true"
          style={{ position: 'fixed', left: pick.rect.left, top: pick.rect.top, width: pick.rect.width, height: pick.rect.height, pointerEvents: 'none' }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto max-w-none" onCloseAutoFocus={event => event.preventDefault()}>
        <IconGridItems current={pick.current} onPick={name => onPick(pick.pos, name)} />
      </DropdownMenuContent>
    </DropdownMenu>,
    document.body,
  )
}

/** A web page's address as the slide keeps it: http or https only, as typed; null for anything else. */
export function webPageAddress(typed: string): string | null {
  const text = typed.trim()
  // A scheme only before `//` (`https://`, `file:///`): `localhost:3000` is a host and its port (review of #769), and
  // a `javascript:` or `data:` text read as a host never parses as one.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname || url.username || url.password || /\s/.test(text)) return null
    return withScheme
  } catch {
    return null
  }
}

export function WebPageDialog({ open, onAdd, onClose }: { open: boolean; onAdd: (address: string) => void; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) setTyped('') }, [open])
  const address = webPageAddress(typed)
  const add = () => { if (address) onAdd(address) }
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
      <DialogContent className="max-w-[420px]" onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }}>
        <DialogHeader icon={<Icon name="globe" size={20} />} onClose={onClose}>
          <DialogTitle>Web page</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription className="text-sm text-[var(--r-ink-strong)] m-0 mb-3">The page's address goes on the slide as a link.</DialogDescription>
          <Input
            ref={inputRef}
            aria-label="The page's address"
            placeholder="https://"
            value={typed}
            onChange={event => setTyped(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
          />
        </DialogBody>
        <DialogFooter>
          <DialogButton variant="secondary" onClick={onClose}>Cancel</DialogButton>
          <DialogButton disabled={!address} onClick={add}>Add the link</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
