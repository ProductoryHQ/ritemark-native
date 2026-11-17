/**
 * Sprint 157: the deck view's line to the host, over the editor's own webview channel (`deck/*`, decoded by the host's
 * `decodeDeckRequest`). The host answers only the webview that asked.
 */
import { useEffect, useRef, useState } from 'react'
import { onMessage, sendToExtension } from '../../bridge'
import { BUILT_IN_THEME, parseTheme, themePathOf, type DeckTheme } from '../../../../src/decks/deckTheme'
import type { DeckSlideEntry } from './deckDocument'
import { slidePicturePaths } from '../../../../src/decks/blocks/slideRenderer'

/** The host's list of pictures it found no file for, as a set; anything else is none. */
export function missingFrom(value: unknown): ReadonlySet<string> {
  return new Set(Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string') : [])
}

/**
 * The slides' pictures as webview URIs, by the paths the slides name, and (17 November) the ones the host looked for
 * and found no file for; asked again when the set of paths changes.
 */
export function useDeckAssets(slides: DeckSlideEntry[]): { assets: Record<string, string>; missing: ReadonlySet<string> } {
  const [found, setFound] = useState<{ assets: Record<string, string>; missing: ReadonlySet<string> }>({ assets: {}, missing: new Set() })
  // A block slide's own pictures too (Sprint 161), by the paths its renderer asks for.
  const paths = [...new Set(slides.flatMap(slide => slidePicturePaths(slide.data)))].sort()
  const key = paths.join('\n')

  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/assets') return
    const next = message.assets
    if (next && typeof next === 'object') setFound({ assets: next as Record<string, string>, missing: missingFrom(message.missing) })
  }), [])

  useEffect(() => {
    if (paths.length === 0) return
    sendToExtension('deck/assets', { paths })
    // `key` stands for `paths`: ask only when the set of pictures changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return found
}

/**
 * Sprint 162 PR 4: the theme with its logo's address as the host found it (a webview URI), or as it is when there is
 * none: a theme naming a logo whose file is missing draws no logo.
 */
export function themeWithLogo(theme: DeckTheme, logo: unknown): DeckTheme {
  return theme.logo && typeof logo === 'string' && logo ? { ...theme, logoUrl: logo } : theme
}

/**
 * The deck's theme: the file its front matter names, read by the host, or the built-in Evening when the deck names
 * none, or one the project doesn't have (a deck is never changed for it).
 */
export function useDeckTheme(themePath: unknown): DeckTheme {
  // A deck naming no theme asks for Evening's path: the project's own Evening file, when it has one, is its Evening.
  const path: string | null = themePathOf(themePath)
  const [theme, setTheme] = useState<{ path: string; theme: DeckTheme } | null>(null)

  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/theme' || typeof message.path !== 'string') return
    const text = typeof message.text === 'string' ? message.text : null
    setTheme({ path: message.path, theme: themeWithLogo(text === null ? BUILT_IN_THEME : parseTheme(text), message.logo) })
  }), [])

  useEffect(() => {
    if (path) sendToExtension('deck/theme', { path })
  }, [path])

  // Sprint 162: while a newly picked theme is read, the deck keeps the theme it had, so a pick never flashes Evening.
  const drawn = useRef<DeckTheme>(BUILT_IN_THEME)
  if (!path) drawn.current = BUILT_IN_THEME
  else if (theme?.path === path) drawn.current = theme.theme
  return drawn.current
}
