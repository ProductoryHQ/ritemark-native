/**
 * Sprint 162 PR 2 (experience 46: step-3-themes.md, README "Themes (15 November)" and "Saving a theme"; frames 11, 18):
 * the theme's own tab. A `Slide library/Themes/<Name>.theme.md` opens here, a mode of the one Markdown editor
 * (`themePages.ts`).
 *
 *   - The bar: the theme's swatch and name, "Used by N decks" (it lists them; a deck opens from the list), then Saved,
 *     or Not saved with Discard, and Save ▾ (Save as a new theme…, Discard the changes).
 *   - On the left, the fields the engine reads: the four colours, each a swatch (a palette) and its hex code (typed),
 *     the soft light in a corner, the line that measures the text against the background, the fonts for headings and
 *     text (each from the six that ship with Ritemark, Sprint 162 PR 3), the corners and the boxes. The logo comes in a
 *     later part of the sprint; nothing of it shows until then.
 *   - On the right, six of the deck's own slides in the draft, as Card or Borderless.
 *
 * Every change goes to the host, which writes it into the theme document's lines (`themeTextWith`): the draft is that
 * document's unsaved text, so the tab has VS Code's dot, Save and Cmd+S write it, and closing the tab asks first. The
 * decks keep their look until Save. What the tab shows is always the document as the host last sent it.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { DECK_FONT_LIST, deckFont, deckFontStack, isDeckFontName, parseTheme, type DeckTheme } from '../../../../../src/decks/deckTheme'
import { newThemeNameProblem, nextThemeName, normalColour, type ThemeChanges } from '../../../../../src/decks/themeFile'
import type { ThemeDeck, ThemePreview } from '../../../../../src/decks/themeProtocol'
import type { DocumentApplyTarget } from '../../../types/documentSync'
import { onMessage, sendToExtension } from '../../../bridge'
import { Button } from '../../ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '../../ui/dropdown-menu'
import { Icon } from '../../ui/Icon'
import { Input } from '../../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { SegmentedControl } from '../../ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SplitButton } from '../../ui/split-button'
import { Switch } from '../../ui/switch'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import { DECK_LOOKS, ThemeSwatch } from '../ThemeMenu'
import { contrastLine } from './themeContrast'
import { ThemeChangeSheet, themeChangeFrom } from './ThemeChangeSheet'
import { changeSlideIndexes, type ThemeChangeView } from '../../../../../src/decks/themeChange'
import '../decks.css'
import './themeTab.css'

/** The palette a colour's swatch offers (the prototype's `PALETTE`); any other colour is typed as a hex code. */
export const THEME_PALETTE = ['#FFFFFF', '#F4F8F5', '#F7F3EE', '#E4E6F7', '#3A4660', '#14213D', '#1C1F4A', '#10261E', '#211B18', '#0B1320', '#F2B544', '#FF7A45', '#0E7C86', '#1F8A5B', '#4338CA', '#D9467A']

/** The four colours, as the frame labels them. */
export const COLOUR_ROWS: Array<{ field: 'bg' | 'head' | 'text' | 'accent'; label: string; note?: string }> = [
  { field: 'bg', label: 'Background' },
  { field: 'head', label: 'Headings' },
  { field: 'text', label: 'Text' },
  { field: 'accent', label: 'Accent', note: 'Numbers, icons, the line under a title' },
]

/** The two font rows (the prototype's Fonts: Headings and Text), each a choice of the six fonts. */
export const FONT_ROWS: Array<{ field: 'fh' | 'fb'; label: string; tip: string }> = [
  { field: 'fh', label: 'Headings', tip: 'The font of the slides\' titles and headings, and of the page\'s headings' },
  { field: 'fb', label: 'Text', tip: 'The font of the slides\' words, and of the page\'s handout' },
]

export const CORNER_OPTIONS = [{ value: 'square', label: 'Square' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: 'Round' }]
export const BOX_OPTIONS = [{ value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }]

/** "Used by 4 decks", "Used by 1 deck", "No deck uses it yet" (prototype). */
export function usedByWords(count: number): string {
  if (count === 0) return 'No deck uses it yet'
  return count === 1 ? 'Used by 1 deck' : `Used by ${count} decks`
}

/** Which step a key asks for: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z and Ctrl+Y redo. */
export function themeUndoKey(event: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): 'undo' | 'redo' | null {
  const mod = event.metaKey || event.ctrlKey
  if (!mod) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && event.ctrlKey && !event.metaKey) return 'redo'
  return null
}

/** "1 deck", "2 decks": the draft bar's count. */
export function decksWords(count: number): string {
  return count === 1 ? '1 deck' : `${count} decks`
}

/** The note at the foot of the settings (frame 11). */
export function themeFileNote(name: string): string {
  return `${name} is a file in Slide library › Themes. Nothing changes in the decks until you save; then every deck that uses it changes, and a published page keeps its look until you update it.`
}

interface ThemeState {
  path: string
  text: string
  dirty: boolean
}

interface ThemeDecks {
  decks: ThemeDeck[]
  preview: ThemePreview
  useIn: string | null
  taken: { names: string[]; files: string[] }
}

/** The host's `theme/decks`, or null when anything in it is malformed. */
export function themeDecksFrom(message: Record<string, unknown>): ThemeDecks | null {
  const preview = message.preview as ThemePreview | undefined
  const taken = message.taken as ThemeDecks['taken'] | undefined
  if (!Array.isArray(message.decks) || !preview || !Array.isArray(preview.slides) || !taken || !Array.isArray(taken.names) || !Array.isArray(taken.files)) return null
  return {
    decks: message.decks.filter((deck): deck is ThemeDeck => !!deck && typeof deck.path === 'string' && typeof deck.name === 'string'),
    preview: { deck: typeof preview.deck === 'string' ? preview.deck : null, borderless: preview.borderless === true, slides: preview.slides, assets: preview.assets && typeof preview.assets === 'object' ? preview.assets : {} },
    useIn: typeof message.useIn === 'string' ? message.useIn : null,
    taken,
  }
}

interface ThemeTabProps {
  /** The document payload the view must say it has shown (the editor's sync): the tab shows the host's state itself. */
  syncTarget?: DocumentApplyTarget
  onExternalApplied: (target: DocumentApplyTarget) => void
  /** The document's own dialogs (a writer's change while the draft is open). */
  dialogs?: ReactNode
}

export function ThemeTab({ syncTarget, onExternalApplied, dialogs }: ThemeTabProps) {
  const [state, setState] = useState<ThemeState | null>(null)
  const [decks, setDecks] = useState<ThemeDecks | null>(null)
  const [notice, setNotice] = useState<{ text: string; token?: string } | null>(null)
  const [look, setLook] = useState<'card' | 'borderless' | null>(null)
  const [saveAs, setSaveAs] = useState(false)
  const [themeChange, setThemeChange] = useState<ThemeChangeView | null>(null)

  useEffect(() => onMessage(message => {
    if (message.type === 'theme/state' && typeof message.text === 'string' && typeof message.path === 'string') {
      setState({ path: message.path, text: message.text, dirty: message.dirty === true })
    } else if (message.type === 'theme/decks') {
      const next = themeDecksFrom(message)
      if (next) setDecks(next)
    } else if (message.type === 'theme/notice' && typeof message.text === 'string') {
      setNotice({ text: message.text, token: typeof message.token === 'string' ? message.token : undefined })
    } else if (message.type === 'theme/change') {
      // Sprint 162 PR 5: See what changed for the AI's colour check, over the preview
      const change = themeChangeFrom(message.change)
      if (change) setThemeChange(change)
    } else if (message.type === 'theme/change-undone' && typeof message.id === 'string') {
      const id = message.id
      setThemeChange(current => (current && current.id === id ? { ...current, undone: true } : current))
    }
  }), [])
  useEffect(() => { sendToExtension('theme/ready') }, [])
  // Cmd+Z and Cmd+Shift+Z (Ctrl on Windows; Ctrl+Y too) outside a text field: the draft's own Undo and Redo. In the
  // capture phase, as the deck's bar does: the webview's own script marks an undo outside a field handled first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.closest('input, textarea, [contenteditable="true"]'))) return
      const step = themeUndoKey(event)
      if (!step) return
      event.preventDefault()
      event.stopPropagation()
      sendToExtension(step === 'undo' ? 'theme/undo' : 'theme/redo')
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  // The tab draws the host's own state, so every document payload is shown as soon as it comes.
  useEffect(() => { if (syncTarget) onExternalApplied(syncTarget) }, [syncTarget, onExternalApplied])
  // A Save's line stays a while; any later line takes its place.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.token ? 9000 : 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const theme = useMemo(() => (state ? parseTheme(state.text) : null), [state])
  const set = useCallback((changes: ThemeChanges) => sendToExtension('theme/set', { changes }), [])
  const save = useCallback(() => sendToExtension('theme/save'), [])
  const discard = useCallback(() => sendToExtension('theme/discard'), [])

  if (!state || !theme) return <div className="theme-tab" aria-busy="true" />
  const dirty = state.dirty
  const count = decks?.decks.length ?? 0
  const borderless = (look ?? (decks?.preview.borderless ? 'borderless' : 'card')) === 'borderless'
  const contrast = contrastLine(theme)

  return (
    <div className="theme-tab">
      <header className="deck-bar theme-bar">
        <ThemeSwatch theme={theme} />
        <span className="theme-bar-name">{theme.name}</span>
        <UsedBy decks={decks?.decks ?? null} />
        <span className="flex-1" />
        {notice ? (
          <span className="deck-notice theme-notice" role="status">
            <Tooltip label={notice.text} className="deck-notice-words">
              <span className="deck-notice-text">{notice.text}</span>
            </Tooltip>
            {notice.token ? (
              <Tooltip label="Put the decks back as they were; your changes stay here, not saved" className="deck-notice-act">
                <Button variant="ghost" size="compact" onClick={() => { sendToExtension('theme/undo-save', { token: notice.token! }); setNotice(null) }}>Undo</Button>
              </Tooltip>
            ) : null}
          </span>
        ) : null}
        {dirty ? (
          <>
            <span className="deck-saved theme-not-saved">
              {/* The Experience lead, 17 November: the draft's bar says what Save will do; the count opens the same list. */}
              Not saved.
              {count ? (
                <>
                  {' Saving changes '}
                  <UsedBy decks={decks?.decks ?? null} words={decksWords(count)} className="theme-saving-count" caret={false} tip="The decks that change when you save" />
                  .
                </>
              ) : null}
            </span>
            <Tooltip label="Throw the changes away; the theme stays as it was">
              <Button variant="ghost" size="bar" onClick={discard}>Discard</Button>
            </Tooltip>
          </>
        ) : (
          <span className="deck-saved">Saved</span>
        )}
        <SplitButton
          size="bar"
          disabled={!dirty}
          main={{
            label: 'Save',
            icon: <Icon name="floppy-disk" size={14} tone="inherit" />,
            tooltip: dirty ? (count ? `Save: every deck that uses ${theme.name} changes (${count === 1 ? '1 deck' : `${count} decks`})` : 'Save the theme file') : 'Nothing to save: no changes yet',
            onClick: save,
          }}
          menu={{
            label: 'More ways to save',
            tooltip: dirty ? 'More ways to save' : 'Nothing to save: no changes yet',
            align: 'end',
            content: (
              <>
                <DropdownMenuItem onSelect={save}>
                  <Icon name="floppy-disk" size={14} tone="inherit" />
                  <span className="theme-menu-two">Save<span>Every deck that uses {theme.name} changes</span></span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSaveAs(true)}>
                  <Icon name="copy" size={14} tone="inherit" />
                  <span className="theme-menu-two">Save as a new theme…<span>{theme.name} and its decks stay as they are</span></span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={discard}>
                  <Icon name="arrow-counter-clockwise" size={14} tone="inherit" />
                  Discard the changes
                </DropdownMenuItem>
              </>
            ),
          }}
        />
      </header>

      <div className="theme-body">
        <section className="theme-settings" aria-label={`${theme.name}'s settings`}>
          <div className="deck-settings-k">Colours</div>
          {COLOUR_ROWS.map(row => (
            <ColourRow key={row.field} label={row.label} note={row.note} value={theme[row.field]} onChange={value => set({ [row.field]: value })} />
          ))}
          <label className="theme-row theme-glow">
            <span className="theme-row-label">Soft light in a corner</span>
            <Tooltip label={theme.glow ? 'Turn the soft light off: a plain background' : 'Turn the soft light on: a glow in the top right corner'}>
              <Switch checked={theme.glow} onCheckedChange={glow => set({ glow })} aria-label="Soft light in a corner" />
            </Tooltip>
          </label>
          <div className={`theme-contrast${contrast.ok ? '' : ' is-low'}`} role="status">
            <Icon name={contrast.ok ? 'check-circle' : 'warning'} size={14} tone="inherit" />
            <span>
              {contrast.words}{' '}
              {/* Sprint 162 PR 5 (17 November): Claude's colour check sits on this line, where a problem shows. At rest a
                  quiet "Check all colours"; when the line is amber, "Fix with Claude". It goes to the open chat. */}
              <Tooltip label={contrast.ok
                ? 'Ask the AI in the open chat to measure all five colour pairs, on the card and borderless'
                : 'Ask the AI in the open chat to move only the colours that fail, into this draft'}>
                <Button variant="link" className="theme-contrast-check" onClick={() => sendToExtension('theme/check-colours')}>
                  {contrast.ok ? 'Check all colours' : 'Fix with Claude'}
                </Button>
              </Tooltip>
            </span>
          </div>

          <div className="deck-settings-k">Fonts</div>
          {FONT_ROWS.map(row => (
            <FontRow key={row.field} label={row.label} tip={row.tip} value={theme[row.field]} onChange={value => set({ [row.field]: value })} />
          ))}

          <div className="deck-settings-k">Shape</div>
          <div className="theme-row">
            <span className="theme-row-label">Corners</span>
            <Tooltip label="The corners of the slide's boxes and pictures" className="theme-seg">
              <SegmentedControl aria-label="Corners" className="theme-seg-control" value={theme.round} onValueChange={value => set({ round: value as DeckTheme['round'] })} options={CORNER_OPTIONS} />
            </Tooltip>
          </div>
          <div className="theme-row">
            <span className="theme-row-label">Boxes</span>
            <Tooltip label="Boxes filled with a shade of the background, or drawn as an outline" className="theme-seg">
              <SegmentedControl aria-label="Boxes" className="theme-seg-control" value={theme.boxes} onValueChange={value => set({ boxes: value as DeckTheme['boxes'] })} options={BOX_OPTIONS} />
            </Tooltip>
          </div>

          <p className="theme-note">
            <Icon name="folder-simple" size={14} tone="inherit" />
            <span>{themeFileNote(theme.name)}</span>
          </p>
        </section>

        <Preview theme={theme} preview={decks?.preview ?? null} borderless={borderless} onLook={value => setLook(value === 'borderless' ? 'borderless' : 'card')} />
        {themeChange ? (
          <ThemeChangeSheet
            change={withPreviewSlides(themeChange, decks?.preview ?? null)}
            style={{ left: 340 }}
            onUndo={() => sendToExtension('theme/change-undo', { id: themeChange.id })}
            onClose={() => setThemeChange(null)}
          />
        ) : null}
      </div>

      {saveAs && decks ? (
        <SaveAsSheet
          from={theme.name}
          count={count}
          useIn={decks.useIn}
          taken={decks.taken}
          onClose={() => setSaveAs(false)}
        />
      ) : null}
      {dialogs}
    </div>
  )
}

/** "Used by N decks", which lists them; a deck in the list opens. */
function UsedBy({ decks, words, className = 'theme-used-by', caret = true, tip = 'The decks that use this theme' }: { decks: ThemeDeck[] | null; words?: string; className?: string; caret?: boolean; tip?: string }) {
  const [open, setOpen] = useState(false)
  const shown = words ?? (decks === null ? 'Reading the decks…' : usedByWords(decks.length))
  if (!decks || decks.length === 0) return <span className={`${className} is-none`}>{shown}</span>
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip label={tip}>
        <PopoverTrigger asChild>
          <Button variant="toolbar" size="bar" className={className}>
            {shown}
            {caret ? <Icon name="caret-down" size={12} tone="inherit" /> : null}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="theme-decks w-[280px] p-1.5" aria-label="The decks that use this theme">
        {decks.map(deck => (
          <Tooltip key={deck.path} label={`Open ${deck.name}`} className="flex w-full">
            <Button
              variant="ghost"
              className="theme-deck-row"
              onClick={() => { setOpen(false); sendToExtension('theme/open-deck', { path: deck.path }) }}
            >
              <Icon name="presentation" size={14} tone="inherit" />
              <span className="theme-deck-name">{deck.name}</span>
            </Button>
          </Tooltip>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** One colour: its label, its swatch (the palette) and its hex code (typed). */
function ColourRow({ label, note, value, onChange }: { label: string; note?: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const editing = useRef(false)
  // The colour as it was when the field took the focus: Escape puts it back, though a whole code typed was sent at once
  const before = useRef(value)
  // The field follows the theme, except while it is being typed in.
  useEffect(() => { if (!editing.current) setText(value) }, [value])
  const typed = normalColour(text)
  const commit = () => {
    editing.current = false
    if (typed && typed !== value) onChange(typed)
    setText(typed ?? value)
  }
  return (
    <div className="theme-row theme-colour">
      <span className="theme-row-label">
        {label}
        {note ? <span className="theme-row-note">{note}</span> : null}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip label={`Choose the ${label.toLowerCase()} colour`}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="theme-swatch-button" style={{ '--swatch': value } as CSSProperties} aria-label={`${label}: choose the colour`} />
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent align="end" className="theme-palette w-auto p-2" aria-label={`${label} colours`}>
          {THEME_PALETTE.map(colour => (
            // On hover only: the focus that opening the palette gives its first colour opens no tooltip over the row
            <Tooltip key={colour} label={colour} hoverOnly>
              <Button
                variant="ghost"
                size="icon-xs"
                className={`theme-palette-colour${colour === value ? ' is-on' : ''}`}
                style={{ '--swatch': colour } as CSSProperties}
                aria-label={colour}
                aria-pressed={colour === value}
                onClick={() => { setOpen(false); if (colour !== value) onChange(colour) }}
              />
            </Tooltip>
          ))}
        </PopoverContent>
      </Popover>
      <Input
        className={`theme-hex${typed ? '' : ' is-wrong'}`}
        value={text}
        spellCheck={false}
        maxLength={7}
        aria-label={`${label}, as a hex code`}
        aria-invalid={!typed}
        onFocus={() => { editing.current = true; before.current = value }}
        onChange={event => {
          editing.current = true
          const next = event.target.value
          setText(next)
          // A whole code shows at once in the preview; a part of one waits.
          const colour = /^#?[0-9a-f]{6}$/i.test(next.trim()) ? normalColour(next) : null
          if (colour && colour !== value) onChange(colour)
        }}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); (event.target as HTMLInputElement).blur() }
          if (event.key === 'Escape') {
            editing.current = false
            if (before.current !== value) onChange(before.current)
            setText(before.current)
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
    </div>
  )
}

/**
 * A font row: the six fonts, each named in its own face. A name the file holds that isn't one of the six ("Futura")
 * shows as itself, drawn in Sofia Sans as the slide draws it (`deckFont`), with no font ticked, so any pick, Sofia Sans
 * too, writes the one line.
 */
function FontRow({ label, tip, value, onChange }: { label: string; tip: string; value: string; onChange: (value: string) => void }) {
  const known = isDeckFontName(value)
  const current = deckFont(value).name
  return (
    <div className="theme-row theme-font">
      <span className="theme-row-label">{label}</span>
      <Select value={known ? current : ''} onValueChange={next => { if (!known || next !== current) onChange(next) }}>
        {/* On hover only: the focus a closing choice gives back to its button opens no tooltip over the pick */}
        <Tooltip label={known ? tip : `${value} doesn't come with Ritemark, so it draws in Sofia Sans. Choose one of the six.`} className="theme-font-select" hoverOnly>
          <SelectTrigger aria-label={`${label} font`} className="w-full" style={{ fontFamily: deckFontStack(current) }}>
            <SelectValue placeholder={`${value} (Sofia Sans)`} />
          </SelectTrigger>
        </Tooltip>
        <SelectContent>
          {DECK_FONT_LIST.map(font => (
            <SelectItem key={font.name} value={font.name} style={{ fontFamily: deckFontStack(font.name) }}>{font.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** The width inside an element's padding, as it is laid out now and after each resize. */
function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const inner = () => {
      const style = getComputedStyle(element)
      return Math.max(0, element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
    }
    setWidth(inner())
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWidth(inner()))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Sprint 162 PR 5: See what changed for the colour check shows the slides this tab previews on (the host sends none for
 * a draft): the first, and the first with Boxes, Steps or Columns, as for a deck.
 */
function withPreviewSlides(change: ThemeChangeView, preview: ThemePreview | null): ThemeChangeView {
  if (change.slides.length || !preview) return change
  return { ...change, slides: changeSlideIndexes(preview.slides).map(index => preview.slides[index]), borderless: preview.borderless, assets: preview.assets }
}

/** The preview gap between slides: Card's and Borderless's (prototype). */
const GAP = { card: 20, borderless: 28 }

/** Six of the deck's slides in the draft (frame 11), as Card or Borderless. */
function Preview({ theme, preview, borderless, onLook }: { theme: DeckTheme; preview: ThemePreview | null; borderless: boolean; onLook: (look: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const gap = borderless ? GAP.borderless : GAP.card
  const columns = width >= 520 ? 2 : 1
  const slideWidth = Math.max(160, Math.floor((width - (columns - 1) * gap) / columns))
  return (
    <section className={`theme-preview${borderless ? ' is-borderless' : ''}`} aria-label="Preview">
      <div className="theme-preview-head">
        <span className="theme-preview-what">
          {preview?.deck ? <>As <b>{preview.deck}</b> looks in it</> : preview ? 'As a deck looks in it' : 'Reading the deck…'}
        </span>
        <span className="flex-1" />
        <Tooltip label="How the preview shows the slides: as a card, or the words on white">
          <SegmentedControl aria-label="Preview look" value={borderless ? 'borderless' : 'card'} onValueChange={onLook} options={DECK_LOOKS} />
        </Tooltip>
      </div>
      <div ref={ref} className="theme-preview-grid" style={{ gridTemplateColumns: `repeat(${columns}, ${slideWidth}px)`, gap }}>
        {width > 0 && preview ? preview.slides.map(slide => (
          <div key={slide.number} className="theme-preview-slide">
            <SlideCanvas kind={slide.kind} data={slide.data} width={slideWidth} theme={theme} borderless={borderless} assets={preview.assets} />
          </div>
        )) : null}
      </div>
    </section>
  )
}

/**
 * Save as a new theme… (README "Saving a theme"): the theme and its decks stay as they were; the new theme is a file
 * beside it, with the changes, and the deck the tab was opened from can use it.
 */
function SaveAsSheet({ from, count, useIn, taken, onClose }: { from: string; count: number; useIn: string | null; taken: { names: string[]; files: string[] }; onClose: () => void }) {
  const [name, setName] = useState(() => nextThemeName(from, taken))
  const [use, setUse] = useState(!!useIn)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => onMessage(message => {
    if (message.type !== 'theme/save-as') return
    setBusy(false)
    if (message.ok === true) onClose()
    else setProblem(typeof message.problem === 'string' ? message.problem : 'The theme could not be saved as a new one.')
  }), [onClose])
  const local = newThemeNameProblem(name, taken)
  const go = () => {
    if (local || busy) { setProblem(local); return }
    setBusy(true)
    setProblem(null)
    sendToExtension('theme/save-as', { name: name.trim(), use: !!useIn && use })
  }
  const shown = problem ?? local
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[480px]"
        aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>('input')?.select() }}
      >
        <DialogHeader onClose={onClose}><DialogTitle>Save as a new theme</DialogTitle></DialogHeader>
        <DialogBody className="theme-sheet">
          <p className="theme-sheet-lede">
            {from} stays as it was{count ? `, and so ${count === 1 ? 'does the deck that uses it' : `do the ${count} decks that use it`}` : ''}. The new theme is a file beside it in Slide library › Themes, with your changes.
          </p>
          <label className="theme-sheet-row">
            <span className="theme-sheet-k">Name</span>
            <Input value={name} maxLength={80} onChange={event => { setName(event.target.value); setProblem(null) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); go() } }} aria-invalid={!!shown} />
          </label>
          {shown ? <p className="theme-sheet-problem" role="alert">{shown}</p> : null}
          {useIn ? (
            <label className="theme-sheet-row theme-sheet-check">
              <span className="theme-sheet-k">This deck</span>
              <span className="theme-sheet-use">
                <input type="checkbox" className="rm-check" checked={use} onChange={event => setUse(event.target.checked)} />
                Use it in {useIn}
              </span>
            </label>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Tooltip label={`Keep the changes in ${from}'s tab`}>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          </Tooltip>
          <Tooltip label={local ?? `Write the new theme; ${from} stays as it was`}>
            <Button size="sm" disabled={!!local || busy} onClick={go}>Save as new theme</Button>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
