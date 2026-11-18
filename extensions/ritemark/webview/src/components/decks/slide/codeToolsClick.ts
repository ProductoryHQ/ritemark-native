/**
 * Sprint 163 PR 1: a click on a drawn slide's code block controls (`codeTools.codeBlockHtml`), on the wall and the
 * presenter view's Now slide. Copy hands the block's whole words to the host and says Copied; ↗ opens and closes its
 * menu; Open in Claude or Open in ChatGPT asks the host to open the address in the person's own browser (never this
 * window, never a link followed here). A click anywhere else, or Esc, closes an open menu, and that click does nothing
 * more (the wall doesn't move on under a closing menu).
 *
 * DOM only: the caller says what Copy and Open do.
 */
import { createContext, useEffect, type RefObject } from 'react'
import { isOpenInAddress } from '../../../../../src/decks/blocks/codeTools'

export interface CodeToolsActions {
  copy: (text: string) => void
  open: (url: string) => void
}

/**
 * The deck's code blocks show their ↗ Open in… (false for a deck with `open-in: none` in its front matter): the deck
 * view gives it for the stage and the strip; Present's views give it from their state.
 */
export const DeckOpenInContext = createContext(true)

/** How long Copy says Copied. */
export const COPIED_MS = 1600

const MENU_OPEN = '.cb-menu:not([hidden])'

/** Close every open ↗ menu under `root` (but `keep`); true when one was open. */
export function closeCodeMenus(root: ParentNode, keep: Element | null = null): boolean {
  let closed = false
  for (const menu of Array.from(root.querySelectorAll(MENU_OPEN))) {
    if (menu === keep) continue
    menu.setAttribute('hidden', '')
    menu.parentElement?.querySelector('.cb-open')?.setAttribute('aria-expanded', 'false')
    closed = true
  }
  return closed
}

/**
 * One click under `root`: 'used' when it was on a code block's controls or closed an open menu (the caller takes it
 * no further), else 'none'.
 */
export function codeToolsClick(target: EventTarget | null, root: ParentNode, actions: CodeToolsActions): 'used' | 'none' {
  const element = target && typeof (target as Element).closest === 'function' ? target as Element : null
  const tools = element?.closest('.cb-tools') ?? null
  if (!tools) return closeCodeMenus(root) ? 'used' : 'none'
  // A pressed control keeps no focus: the wall shows no ring once its menu closes (the keyboard never reaches them).
  const active = tools.ownerDocument?.activeElement as (Element & { blur?: () => void }) | null | undefined
  if (active && tools.contains(active)) active.blur?.()
  const item = element!.closest('a.cb-item')
  if (item) {
    const href = item.getAttribute('href')
    if (isOpenInAddress(href)) actions.open(href)
    closeCodeMenus(root)
    return 'used'
  }
  const copy = element!.closest('.cb-copy')
  if (copy) {
    closeCodeMenus(root)
    const code = Array.from(tools.parentElement?.children ?? []).find(child => child.tagName.toLowerCase() === 'code')
    const words = code?.textContent ?? ''
    if (words) {
      actions.copy(words)
      copy.classList.add('ok')
      setTimeout(() => copy.classList.remove('ok'), COPIED_MS)
    }
    return 'used'
  }
  const open = element!.closest('.cb-open')
  const menu = tools.querySelector('.cb-menu')
  if (open && menu) {
    const opening = menu.hasAttribute('hidden')
    closeCodeMenus(root, menu)
    if (opening) menu.removeAttribute('hidden')
    else menu.setAttribute('hidden', '')
    open.setAttribute('aria-expanded', opening ? 'true' : 'false')
  }
  return 'used'
}

/**
 * The wall's and the presenter view's code block controls under `ref`: clicks taken before the view's own (so a Copy
 * never moves the wall on), and Esc closing an open menu before anything else hears it. `ready`: the element under
 * `ref` is drawn (a view that draws an empty frame first).
 */
export function useCodeToolsClicks(ref: RefObject<HTMLElement | null>, actions: CodeToolsActions, ready = true): void {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      if (codeToolsClick(event.target, root, actions) !== 'used') return
      event.preventDefault()
      event.stopPropagation()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !closeCodeMenus(root)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    root.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      root.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [ref, actions, ready])
}
