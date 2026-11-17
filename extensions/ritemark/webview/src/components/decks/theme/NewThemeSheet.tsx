/**
 * Sprint 162 PR 2 (step-3-themes.md "Making a theme"; README frame 14): New theme…, from the deck's Theme menu. It names
 * the theme and starts it from a copy of the deck's theme, Paper or Ember, each shown as one of the deck's own slides in
 * that start's look. "Use it in this deck" is ticked. Make the theme writes `Slide library/Themes/<Name>.theme.md`, the
 * deck uses it when ticked (one step of its Undo, as a pick), and the theme's tab opens.
 *
 * Claude's own row ("Ask Claude to make it from the client's brand files") comes with the AI part of the sprint (PR 5):
 * nothing of it shows until then.
 */
import { useEffect, useState } from 'react'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { newThemeNameProblem, nextThemeName, START_WORDS, startTheme, type ThemeStart } from '../../../../../src/decks/themeFile'
import { onMessage, sendToExtension } from '../../../bridge'
import { Button } from '../../ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Input } from '../../ui/input'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import './themeTab.css'

/** A start's picture is this wide (frame 14). */
const START_WIDTH = 138

/** The first name the sheet offers: "New theme", or the first one free after it. */
export function firstThemeName(taken: { names: readonly string[]; files: readonly string[] }): string {
  return newThemeNameProblem('New theme', taken) === null ? 'New theme' : nextThemeName('New theme', taken)
}

/** The three starts, as frame 14 words them. */
export function themeStarts(deckTheme: DeckTheme): Array<{ start: ThemeStart; name: string; note: string }> {
  return [
    { start: 'copy', name: `A copy of ${deckTheme.name}`, note: 'The one this deck uses' },
    { start: 'paper', ...START_WORDS.paper },
    { start: 'ember', ...START_WORDS.ember },
  ]
}

interface NewThemeSheetProps {
  /** The theme the deck draws: the copy's start. */
  deckTheme: DeckTheme
  deckName: string
  /** One of the deck's slides, drawn in each start's look; none for a deck with no slides. */
  slide: { kind: string; data: SlideData } | null
  assets: Record<string, string>
  borderless: boolean
  taken: { names: string[]; files: string[] }
  onClose: () => void
}

export function NewThemeSheet({ deckTheme, deckName, slide, assets, borderless, taken, onClose }: NewThemeSheetProps) {
  const [name, setName] = useState(() => firstThemeName(taken))
  const [start, setStart] = useState<ThemeStart>('copy')
  const [use, setUse] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/new-theme') return
    setBusy(false)
    if (message.ok === true) onClose()
    else setProblem(typeof message.problem === 'string' ? message.problem : 'The theme could not be made.')
  }), [onClose])
  const local = newThemeNameProblem(name, taken)
  const make = () => {
    if (local || busy) { setProblem(local); return }
    setBusy(true)
    setProblem(null)
    sendToExtension('deck/new-theme', { name: name.trim(), start, use })
  }
  const shown = problem ?? (name.trim() ? local : null)
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[600px]"
        onOpenAutoFocus={event => { event.preventDefault(); (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>('input')?.select() }}
      >
        <DialogHeader onClose={onClose}><DialogTitle>New theme</DialogTitle></DialogHeader>
        <DialogBody className="theme-sheet">
          <DialogDescription className="theme-sheet-lede">
            A theme is a file in Slide library › Themes: its colours and its shape. Every deck that uses it changes when it changes.
          </DialogDescription>
          <label className="theme-sheet-row">
            <span className="theme-sheet-k">Name</span>
            <Input value={name} maxLength={80} onChange={event => { setName(event.target.value); setProblem(null) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); make() } }} aria-invalid={!!shown} aria-label="The theme's name" />
          </label>
          {shown ? <p className="theme-sheet-problem" role="alert">{shown}</p> : null}
          <div className="theme-sheet-row" style={{ alignItems: 'start' }}>
            <span className="theme-sheet-k">Start from</span>
            <div className="theme-starts" role="radiogroup" aria-label="Start from">
              {themeStarts(deckTheme).map(entry => (
                <Tooltip key={entry.start} label={entry.start === 'copy' ? `Start from ${deckTheme.name}, the theme this deck uses` : `Start from ${entry.name}: ${entry.note.toLowerCase()}`}>
                  <Button
                    variant="ghost"
                    className="theme-start h-auto items-start justify-start whitespace-normal p-0 has-[>svg]:px-0 hover:bg-transparent"
                    role="radio"
                    aria-checked={start === entry.start}
                    aria-pressed={start === entry.start}
                    onClick={() => setStart(entry.start)}
                  >
                    <span className="theme-start-pic" style={{ width: START_WIDTH }}>
                      {slide ? (
                        <SlideCanvas kind={slide.kind} data={slide.data} width={START_WIDTH} theme={startTheme(entry.start, deckTheme)} borderless={borderless} assets={assets} />
                      ) : (
                        <span style={{ display: 'block', width: START_WIDTH, height: Math.round(START_WIDTH * 9 / 16), background: startTheme(entry.start, deckTheme).bg }} />
                      )}
                    </span>
                    {entry.name}
                    <span className="theme-start-note">{entry.note}</span>
                  </Button>
                </Tooltip>
              ))}
            </div>
          </div>
          <label className="theme-sheet-row theme-sheet-check">
            <span className="theme-sheet-k">This deck</span>
            <span className="theme-sheet-use">
              <input type="checkbox" className="rm-check" checked={use} onChange={event => setUse(event.target.checked)} />
              Use it in {deckName}
            </span>
          </label>
        </DialogBody>
        <DialogFooter>
          <Tooltip label="Close without making a theme">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          </Tooltip>
          <Tooltip label={local ?? `Write ${name.trim()} in Slide library › Themes and open it`}>
            <Button size="sm" disabled={!!local || busy} onClick={make}>Make the theme</Button>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
