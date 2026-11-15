/**
 * Sprint 157: the deck view's line to the host, over the editor's own webview channel (`deck/*`, decoded by the host's
 * `decodeDeckRequest`). The host answers only the webview that asked.
 */
import { useEffect, useState } from 'react'
import { onMessage, sendToExtension } from '../../bridge'
import { BUILT_IN_THEME, isThemePath, parseTheme, type DeckTheme } from '../../../../src/decks/deckTheme'
import type { DeckSlideEntry } from './deckDocument'

/** The slides' pictures as webview URIs, by the paths the slides name; asked again when the set of paths changes. */
export function useDeckAssets(slides: DeckSlideEntry[]): Record<string, string> {
  const [assets, setAssets] = useState<Record<string, string>>({})
  const paths = [...new Set(slides.map(slide => slide.data.image).filter((path): path is string => !!path))].sort()
  const key = paths.join('\n')

  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/assets') return
    const next = message.assets
    if (next && typeof next === 'object') setAssets(next as Record<string, string>)
  }), [])

  useEffect(() => {
    if (paths.length === 0) return
    sendToExtension('deck/assets', { paths })
    // `key` stands for `paths`: ask only when the set of pictures changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return assets
}

/**
 * The deck's theme: the file its front matter names, read by the host, or the built-in Evening when the deck names
 * none, or one the project doesn't have (a deck is never changed for it).
 */
export function useDeckTheme(themePath: unknown): DeckTheme {
  const path = typeof themePath === 'string' && isThemePath(themePath) ? themePath : null
  const [theme, setTheme] = useState<{ path: string; theme: DeckTheme } | null>(null)

  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/theme' || typeof message.path !== 'string') return
    const text = typeof message.text === 'string' ? message.text : null
    setTheme({ path: message.path, theme: text === null ? BUILT_IN_THEME : parseTheme(text) })
  }), [])

  useEffect(() => {
    if (path) sendToExtension('deck/theme', { path })
  }, [path])

  return path && theme?.path === path ? theme.theme : BUILT_IN_THEME
}
