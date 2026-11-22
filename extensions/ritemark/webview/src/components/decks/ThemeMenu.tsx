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
 *   - TRANSITION (README item 19): Fade | Push | Zoom | None, how the wall goes from one slide to the next. Fade is the
 *     default and writes nothing; any other writes `transition: <it>` in the front matter, as one step of the same Undo.
 *     Choosing one plays it once on the stage (`TransitionPreview`). The menu stays open, as for LOOK.
 *
 * A popover (shadcn's, on Radix), not a dropdown menu: the look's segmented control is a radio group, which a menu's
 * own arrow keys would take over. It closes on a press outside and on Esc and gives the focus back to the button.
 */
import { useEffect, useMemo, useState } from 'react'
import { deckCountLabel, themeKeyOf, themeOfEntry, type DeckTheme, type ThemeEntry } from '../../../../src/decks/deckTheme'
import { onMessage, sendToExtension } from '../../bridge'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { SegmentedControl } from '../ui/segmented-control'
import { Tooltip } from '../ui/tooltip'
import type { SlideData } from '../../../../src/decks/deckFormat'
import { NewThemeSheet } from './theme/NewThemeSheet'
import { DECK_TRANSITIONS, DECK_TRANSITION_TIP, type DeckTransition } from './present/wallMotion'

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
  /** README 19: the deck's transition, and a choice of one (written, then played on the stage). */
  transition?: DeckTransition
  onTransition?: (transition: string) => void
  /** A theme picked: its path and name. Never called for the theme the deck already draws. */
  onPick: (path: string, name: string) => void
  /**
   * Sprint 162 PR 2: what New theme… shows of this deck: its name, and one of its slides (a slide with boxes when it has
   * one, as frame 14) with its pictures. Without it the menu has no Edit or New theme….
   */
  newTheme?: { deckName: string; slide: { kind: string; data: SlideData } | null; assets: Record<string, string> }
}

/** The names and files the project's themes have, for a new theme's name (the host checks again as it writes). */
export function takenThemeNames(entries: readonly ThemeEntry[]): { names: string[]; files: string[] } {
  return {
    names: entries.map(entry => themeOfEntry(entry).name),
    files: entries.filter(entry => entry.text !== null).map(entry => entry.path.slice(entry.path.lastIndexOf('/') + 1)),
  }
}

export function ThemeMenu({ theme, named, look, onLook, transition, onTransition, onPick, newTheme }: ThemeMenuProps) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ThemeEntry[] | null>(null)
  const [making, setMaking] = useState(false)

  useEffect(() => onMessage(message => {
    if (message.type === 'deck/themes') setEntries(themeEntriesFrom(message.themes))
  }), [])

  // Asked each time the menu opens: what was there the last time may have changed since.
  useEffect(() => {
    if (open) sendToExtension('deck/themes')
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* When the notice has given up its room, the bar can show just the swatch. The tooltip always names the theme. */}
      <Tooltip label={`${theme.name}: the deck's look and theme`} className="deck-theme-slot">
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
          transition={transition}
          onTransition={onTransition}
          onPick={(path, name) => {
            setOpen(false)
            onPick(path, name)
          }}
          onCurrent={() => setOpen(false)}
          onEdit={newTheme ? path => { setOpen(false); sendToExtension('deck/edit-theme', { path }) } : undefined}
          onNew={newTheme ? () => { setOpen(false); setMaking(true) } : undefined}
        />
      </PopoverContent>
      {making && newTheme ? (
        <NewThemeSheet
          deckTheme={theme}
          deckName={newTheme.deckName}
          slide={newTheme.slide}
          assets={newTheme.assets}
          borderless={look === 'borderless'}
          taken={takenThemeNames(entries ?? [])}
          onClose={() => setMaking(false)}
        />
      ) : null}
    </Popover>
  )
}

interface ThemeMenuBodyProps {
  /** The project's themes, or null while the host reads them. */
  entries: ThemeEntry[] | null
  named: unknown
  look: 'card' | 'borderless'
  onLook: (look: string) => void
  /** README 19: TRANSITION, under THEME, when the deck view gives it. */
  transition?: DeckTransition
  onTransition?: (transition: string) => void
  onPick: (path: string, name: string) => void
  /** The theme the deck already draws, picked: the menu closes and nothing is written. */
  onCurrent: () => void
  /** Sprint 162 PR 2: Edit <Name>: the theme file the deck draws opens in its own tab. */
  onEdit?: (path: string) => void
  /** Sprint 162 PR 2: New theme…: the sheet that names a new theme and starts it (frame 14). */
  onNew?: () => void
}

/**
 * The menu's sections: LOOK, then THEME with the project's themes, the one the deck draws ticked; then (Sprint 162 PR 2,
 * frame 12) Edit <Name> for the theme the deck draws, and New theme…. Edit shows only for a theme the project has a file
 * for: the built-in Evening has none to open until the project makes one (a copy, from New theme…).
 */
export function ThemeMenuBody({ entries, named, look, onLook, transition, onTransition, onPick, onCurrent, onEdit, onNew }: ThemeMenuBodyProps) {
  const current = entries ? themeKeyOf(named, entries) : null
  // Each theme file read once per list, not at every render of the open menu.
  const themes = useMemo(() => new Map((entries ?? []).map(entry => [entry.path, themeOfEntry(entry)])), [entries])
  const currentEntry = entries?.find(entry => entry.path === current) ?? null
  const editable = currentEntry && currentEntry.text !== null ? currentEntry : null
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
          const entryTheme = themes.get(entry.path) ?? themeOfEntry(entry)
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
      {onTransition ? (
        <>
          <div className="deck-theme-sep" />
          <div role="group" aria-labelledby="deck-theme-transition">
            <div id="deck-theme-transition" className="deck-settings-k">Transition</div>
            <Tooltip label={DECK_TRANSITION_TIP} className="flex w-full">
              <SegmentedControl
                aria-label="How one slide becomes the next"
                className="w-full [&>label]:flex-1 [&>label>span]:w-full [&>label>span]:text-center [&>label>span]:px-1"
                value={transition ?? 'fade'}
                onValueChange={onTransition}
                options={DECK_TRANSITIONS as Array<{ value: string; label: string }>}
                // The one already chosen plays again when clicked (it writes nothing), so Fade can be seen too.
                inputProps={{ [transition ?? 'fade']: { onClick: () => onTransition(transition ?? 'fade') } }}
              />
            </Tooltip>
          </div>
        </>
      ) : null}
      {entries !== null && (onEdit || onNew) ? (
        <>
          <div className="deck-theme-sep" />
          {editable && onEdit ? (
            <Tooltip label={`Change ${themes.get(editable.path)?.name ?? 'the theme'}'s colours and shape in its own tab`} className="flex w-full">
              <Button variant="ghost" className="deck-theme-row" onClick={() => onEdit(editable.path)}>
                <Icon name="palette" size={14} tone="inherit" />
                <span className="deck-theme-row-name">Edit {themes.get(editable.path)?.name}</span>
              </Button>
            </Tooltip>
          ) : null}
          {onNew ? (
            <Tooltip label="Make a theme of your own, from this deck's theme, Paper or Ember" className="flex w-full">
              <Button variant="ghost" className="deck-theme-row" onClick={onNew}>
                <Icon name="plus" size={14} tone="inherit" />
                <span className="deck-theme-row-name">New theme…</span>
              </Button>
            </Tooltip>
          ) : null}
        </>
      ) : null}
    </>
  )
}
