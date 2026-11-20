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
import { isButtonAddress, isWordLinkAddress } from '../../../../../src/decks/blocks/buttonBlock'
import { sendToExtension } from '../../../bridge'

export interface CodeToolsActions {
  copy: (text: string) => void
  open: (url: string) => void
  /**
   * Sprint 163 PR 3: a Button block's button, its full https address (`buttonBlock.buttonHtml` puts no other on it);
   * #930: a link in the slide's words, its full http(s) or mailto address.
   */
  link?: (url: string) => void
}

/**
 * The deck's code blocks show their ↗ Open in… (false for a deck with `open-in: none` in its front matter): the deck
 * view gives it for the stage and the strip; Present's views give it from their state.
 */
export const DeckOpenInContext = createContext(true)

/** How long Copy says Copied. */
export const COPIED_MS = 1600

/** Present's: Copy and Open in done by the host (the clipboard, the person's own browser), for the wall and the presenter view. */
export const PRESENT_CODE_ACTIONS: CodeToolsActions = {
  copy: text => sendToExtension('present/copy', { text }),
  open: url => sendToExtension('present/open-in', { url }),
  link: url => sendToExtension('present/open-link', { url }),
}

const MENU_OPEN = '.cb-menu:not([hidden])'

/**
 * Open a ↗'s menu below it, or above it when the slide's flow (which clips) has no room below and more above (a prompt
 * is often a slide's last block).
 */
export function placeCodeMenu(menu: Element): void {
  menu.classList.remove('is-up')
  const flow = menu.closest('.blk-flow')
  if (!flow || typeof (menu as HTMLElement).getBoundingClientRect !== 'function') return
  const room = flow.getBoundingClientRect()
  const box = menu.getBoundingClientRect()
  const opener = menu.parentElement?.querySelector('.cb-open')?.getBoundingClientRect()
  if (!opener || box.bottom <= room.bottom) return
  if (opener.top - room.top > room.bottom - opener.bottom) menu.classList.add('is-up')
}

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
  // Sprint 163 PR 3: a button on the slide opens its address in the person's own browser (the host checks it again);
  // a button with no full https address does nothing, and neither moves the wall on.
  const button = element?.closest('.blk-btn') ?? null
  if (button && actions.link) {
    closeCodeMenus(root)
    const href = button.getAttribute('data-href')
    if (isButtonAddress(href)) actions.link(href)
    return 'used'
  }
  // #930: a link in the slide's words opens the same way (the renderer puts only a full http(s) or mailto address on
  // it, `isWordLinkAddress`; the host checks it against the deck again). Words with no address stay words.
  const wordLink = element?.closest('.blk-link[data-href]') ?? null
  if (wordLink && actions.link) {
    closeCodeMenus(root)
    const href = wordLink.getAttribute('data-href')
    if (isWordLinkAddress(href)) actions.link(href)
    return 'used'
  }
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
      // A second Copy says Copied as long as the first did (the page's Copy keeps its timer the same way).
      const held = copy as Element & { okTimer?: ReturnType<typeof setTimeout> }
      clearTimeout(held.okTimer)
      held.okTimer = setTimeout(() => copy.classList.remove('ok'), COPIED_MS)
    }
    return 'used'
  }
  const open = element!.closest('.cb-open')
  const menu = tools.querySelector('.cb-menu')
  if (open && menu) {
    const opening = menu.hasAttribute('hidden')
    closeCodeMenus(root, menu)
    if (opening) {
      menu.removeAttribute('hidden')
      placeCodeMenu(menu)
    } else menu.setAttribute('hidden', '')
    open.setAttribute('aria-expanded', opening ? 'true' : 'false')
  }
  return 'used'
}

let escapeInstalled = false

/**
 * Esc closes an open ↗ menu and goes no further (Present would stop on it). Its listener is the window's first, put in
 * once while the view first draws, before any effect of the view adds its own keys (review of #804: an effect's listener
 * came after the wall's, which stopped Present).
 */
function installMenuEscape(): void {
  if (escapeInstalled || typeof window === 'undefined') return
  escapeInstalled = true
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !closeCodeMenus(document)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}

/**
 * The wall's and the presenter view's code block controls under `ref`: clicks taken before the view's own (so a Copy
 * never moves the wall on), and Esc closing an open menu before anything else hears it. `ready`: the element under
 * `ref` is drawn (a view that draws an empty frame first). A thumbnail's controls are drawn only (`slide.css`).
 */
export function useCodeToolsClicks(ref: RefObject<HTMLElement | null>, actions: CodeToolsActions, ready = true): void {
  installMenuEscape()
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      if (codeToolsClick(event.target, root, actions) !== 'used') return
      event.preventDefault()
      event.stopPropagation()
    }
    root.addEventListener('click', onClick, true)
    return () => root.removeEventListener('click', onClick, true)
  }, [ref, actions, ready])
}
