/**
 * Sprint 162 (experience 46, step-3-themes.md; README frame 12): the deck's one look control, the Theme button on the
 * deck's bar, on its right before Saved. It shows the theme's colours as a small swatch and its name ("Evening ▾").
 *
 * Its menu holds the deck's whole look:
 *   - LOOK: Card | Borderless, the deck's own choice in its front matter (`look:`), written by the same `setLook` the
 *     slide settings popover's "This deck" section used until this sprint (that section is gone: the popover keeps only
 *     the slide's own settings);
 *   - THEME: the project's themes (the files in `Slide library/Themes`, and the built-in theme), each with its swatch,
 *     its name and how many of the project's decks draw it, the current one ticked. The host lists them each time the
 *     menu opens (`deck/themes`), so a deck saved elsewhere or a theme file added since counts at once.
 * A pick writes the deck's `theme:` line as one step of the deck's Undo (`theme/themePick.ts`) and closes the menu.
 *
 * A popover (shadcn's, on Radix), not a dropdown menu: the look's segmented control is a radio group, which a menu's
 * own arrow keys would take over. It closes on a press outside and on Esc and gives the focus back to the button.
 */
import { useEffect, useState } from 'react'
import { deckCountLabel, themeKeyOf, themeOfEntry, type DeckTheme, type ThemeEntry } from '../../../../src/decks/deckTheme'
import { onMessage, sendToExtension } from '../../bridge'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { SegmentedControl } from '../ui/segmented-control'
import { Tooltip } from '../ui/tooltip'

/** Card or Borderless, with the words and the tooltip they have had since the bar's segment (16 November). */
export const DECK_LOOKS = [{ value: 'card', label: 'Card' }, { value: 'borderless', label: 'Borderless' }]
export const DECK_LOOK_TIP = 'How the slides look: as a card, or the whole column as the stage'

/** A theme's colours, small: its background, with a bar in its accent and one in its headings' colour (frame 12). */
export function ThemeSwatch({ theme }: { theme: DeckTheme }) {
  return (
    <span className="deck-theme-swatch" style={{ background: theme.bg }} aria-hidden="true">
      <i style={{ background: theme.accent }} />
      <i style={{ background: theme.head }} />
    </span>
  )
}

/** The host's list of the project's themes, from a `deck/themes` message; anything malformed is left out. */
export function themeEntriesFrom(value: unknown): ThemeEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is ThemeEntry => !!entry && typeof entry === 'object'
    && typeof (entry as ThemeEntry).path === 'string'
    && ((entry as ThemeEntry).text === null || typeof (entry as ThemeEntry).text === 'string')
    && typeof (entry as ThemeEntry).decks === 'number')
}

/** The bar notice after a pick (step-3-themes.md). */
export function themePickedNotice(name: string): string {
  return `This deck uses ${name} now.`
}

interface ThemeMenuProps {
  /** The theme the deck draws now. */
  theme: DeckTheme
  /** The deck's `theme:` value as its front matter holds it (anything, or nothing). */
  named: unknown
  look: 'card' | 'borderless'
  onLook: (look: string) => void
  /** A theme picked: its path and name. Never called for the theme the deck already draws. */
  onPick: (path: string, name: string) => void
}

export function ThemeMenu({ theme, named, look, onLook, onPick }: ThemeMenuProps) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ThemeEntry[] | null>(null)

  useEffect(() => onMessage(message => {
    if (message.type === 'deck/themes') setEntries(themeEntriesFrom(message.themes))
  }), [])

  // Asked each time the menu opens: what was there the last time may have changed since.
  useEffect(() => {
    if (open) sendToExtension('deck/themes')
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip label="The deck's look and theme">
        <PopoverTrigger asChild>
          <Button variant="toolbar" size="bar" className="deck-theme-button" aria-label={`Theme: ${theme.name}`}>
            <ThemeSwatch theme={theme} />
            <span className="deck-theme-name">{theme.name}</span>
            <Icon name="caret-down" size={12} tone="inherit" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="deck-theme-menu w-[232px] p-2" aria-label="The deck's look and theme">
        <ThemeMenuBody
          entries={entries}
          named={named}
          look={look}
          onLook={onLook}
          onPick={(path, name) => {
            setOpen(false)
            onPick(path, name)
          }}
          onCurrent={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

interface ThemeMenuBodyProps {
  /** The project's themes, or null while the host reads them. */
  entries: ThemeEntry[] | null
  named: unknown
  look: 'card' | 'borderless'
  onLook: (look: string) => void
  onPick: (path: string, name: string) => void
  /** The theme the deck already draws, picked: the menu closes and nothing is written. */
  onCurrent: () => void
}

/** The menu's two sections: LOOK, then THEME with the project's themes, the one the deck draws ticked. */
export function ThemeMenuBody({ entries, named, look, onLook, onPick, onCurrent }: ThemeMenuBodyProps) {
  const current = entries ? themeKeyOf(named, new Set(entries.map(entry => entry.path))) : null
  return (
    <>
      <div role="group" aria-labelledby="deck-theme-look">
        <div id="deck-theme-look" className="deck-settings-k">Look</div>
        <Tooltip label={DECK_LOOK_TIP} className="flex w-full">
          <SegmentedControl
            aria-label="How the slides look"
            className="w-full [&>label]:flex-1 [&>label>span]:w-full [&>label>span]:text-center"
            value={look}
            onValueChange={onLook}
            options={DECK_LOOKS}
          />
        </Tooltip>
      </div>
      <div className="deck-theme-sep" />
      <div role="group" aria-labelledby="deck-theme-themes">
        <div id="deck-theme-themes" className="deck-settings-k">Theme</div>
        {entries === null ? (
          <div className="deck-theme-wait">Reading the project's themes…</div>
        ) : entries.map(entry => {
          const entryTheme = themeOfEntry(entry)
          const chosen = entry.path === current
          return (
            <Tooltip
              key={entry.path}
              label={chosen ? `This deck uses ${entryTheme.name}` : `Use ${entryTheme.name} in this deck`}
              className="flex w-full"
            >
              <Button
                variant="ghost"
                className="deck-theme-row"
                aria-pressed={chosen}
                onClick={() => (chosen ? onCurrent() : onPick(entry.path, entryTheme.name))}
              >
                <ThemeSwatch theme={entryTheme} />
                <span className="deck-theme-row-name">{entryTheme.name}</span>
                <span className="deck-theme-row-count">{deckCountLabel(entry.decks)}</span>
                <span className="deck-theme-row-check">{chosen ? <Icon name="check" size={14} tone="inherit" /> : null}</span>
              </Button>
            </Tooltip>
          )
        })}
      </div>
    </>
  )
}
