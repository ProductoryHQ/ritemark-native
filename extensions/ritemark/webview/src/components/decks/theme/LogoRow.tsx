/**
 * Sprint 162 PR 4 (step-3-themes.md, "Logo"; the prototype's `.tdrop` and `.tlogo`): the theme tab's Logo rows.
 *
 *   - No logo: one place to drop a picture on, or to choose a file (an SVG or a PNG). The host checks it, copies it
 *     beside the theme file and names it in the draft (`ThemePages.takeLogo`).
 *   - A logo: the picture on the theme's own background, with Replace and Remove; then Where (top left, top right or
 *     bottom right) and On (every slide, or the title slides only), each one field line in the draft.
 *   - A logo whose file is missing (or can't be the logo): the line says so, with Choose a file… and Remove; the
 *     slides draw no logo meanwhile.
 *
 * The picture is always an `<img>`: an SVG logo is never put into the tab as markup.
 */
import { useState, type DragEvent } from 'react'
import { DEFAULT_LOGO_ON, DEFAULT_LOGO_PLACE, type DeckTheme, type LogoOn, type LogoPlace } from '../../../../../src/decks/deckTheme'
import type { ThemeChanges } from '../../../../../src/decks/themeFile'
import type { ThemeLogoState } from '../../../../../src/decks/themeProtocol'
import { LOGO_TOO_LARGE, logoKindOfName, MAX_LOGO_BYTES } from '../../../../../src/decks/themeLogo'
import { sendToExtension } from '../../../bridge'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { SegmentedControl } from '../../ui/segmented-control'
import { Tooltip } from '../../ui/tooltip'

export const LOGO_PLACE_OPTIONS: Array<{ value: LogoPlace; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-right', label: 'Bottom right' },
]
export const LOGO_ON_OPTIONS: Array<{ value: LogoOn; label: string }> = [
  { value: 'every-slide', label: 'Every slide' },
  { value: 'title-slides', label: 'Title slides' },
]

/** The MIME type a logo's file name says, for its data URL (the host's own rule, `logoKindOfName`); null for any other. */
export function logoMimeOf(name: string): 'image/svg+xml' | 'image/png' | null {
  const kind = logoKindOfName(name)
  return kind === 'svg' ? 'image/svg+xml' : kind === 'png' ? 'image/png' : null
}

/** Why a dropped file can't be sent as the logo before it is read (its name, empty, too large), or null. */
export function droppedLogoProblem(file: { name: string; size: number }): string | null {
  if (!logoMimeOf(file.name)) return 'A logo is an SVG or a PNG picture.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_LOGO_BYTES) return LOGO_TOO_LARGE
  return null
}

/** Does this drag carry files (a picture from the Finder, the Explorer)? */
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/** A dropped file as the host takes it: its bytes as an SVG or PNG data URL (whatever type the system gave it). */
function sendLogoFile(file: File, onWrong: (text: string) => void) {
  const problem = droppedLogoProblem(file)
  const mime = logoMimeOf(file.name)
  if (problem || !mime) {
    // Said here: the host never gets a file it would refuse unread (the review of #785).
    onWrong(problem ?? 'A logo is an SVG or a PNG picture.')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const bytes = new Uint8Array(reader.result as ArrayBuffer)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    sendToExtension('theme/logo-file', { dataUrl: `data:${mime};base64,${btoa(binary)}`, filename: file.name.split(/[\\/]/).pop() || `logo.${mime === 'image/png' ? 'png' : 'svg'}` })
  }
  reader.onerror = () => onWrong('That file could not be read.')
  reader.readAsArrayBuffer(file)
}

interface LogoRowsProps {
  theme: DeckTheme
  /** The draft's logo as the host found it; null for none. */
  logo: ThemeLogoState | null
  /** The theme's background, behind the picture (the prototype's `.tlogo`). */
  ground: string
  onChange: (changes: ThemeChanges) => void
}

export function LogoRows({ theme, logo, ground, onChange }: LogoRowsProps) {
  const [over, setOver] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const choose = () => { setWrong(null); sendToExtension('theme/choose-logo') }
  const drop = {
    onDragOver: (event: DragEvent) => { if (!carriesFiles(event)) return; event.preventDefault(); event.stopPropagation(); setOver(true) },
    onDragLeave: (event: DragEvent) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setOver(false) },
    onDrop: (event: DragEvent) => {
      setOver(false)
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      event.preventDefault()
      event.stopPropagation()
      setWrong(null)
      sendLogoFile(file, setWrong)
    },
  }

  if (!theme.logo) {
    return (
      <>
        <Tooltip label="Choose an SVG or a PNG picture, or drop one here. It's copied beside the theme file." className="flex w-full">
          <Button variant="ghost" className={`theme-logo-drop${over ? ' is-over' : ''}`} onClick={choose} {...drop}>
            <Icon name="image" size={20} tone="inherit" />
            <span>Drop a logo here, or <b>choose a file</b></span>
          </Button>
        </Tooltip>
        {wrong ? <p className="theme-logo-problem" role="alert">{wrong}</p> : null}
      </>
    )
  }

  const place = theme.logo.place ?? DEFAULT_LOGO_PLACE
  const on = theme.logo.on ?? DEFAULT_LOGO_ON
  const problem = wrong ?? logo?.problem ?? null
  return (
    <>
      <div className={`theme-logo-box${over ? ' is-over' : ''}${logo?.url ? '' : ' is-missing'}`} style={logo?.url ? { background: ground } : undefined} {...drop}>
        {logo?.url ? (
          <img className="theme-logo-picture" src={logo.url} alt={`${theme.name}'s logo`} draggable={false} />
        ) : (
          <span className="theme-logo-gone">
            <Icon name="warning" size={14} tone="inherit" />
            <span>{theme.logo.file}</span>
          </span>
        )}
        <span className="flex-1" />
        <Tooltip label="Choose another SVG or PNG picture, or drop one here">
          <Button variant="ghost" size="compact" className="theme-logo-act" onClick={choose}>{logo?.url ? 'Replace' : 'Choose a file…'}</Button>
        </Tooltip>
        <Tooltip label="Take the logo off the theme; the picture stays beside the theme file">
          <Button variant="ghost" size="compact" className="theme-logo-act is-quiet" onClick={() => { setWrong(null); onChange({ logo: null }) }}>Remove</Button>
        </Tooltip>
      </div>
      {problem ? <p className="theme-logo-problem" role="status">{problem}</p> : null}
      <div className="theme-row">
        <span className="theme-row-label">Where</span>
        <Tooltip label="The corner of the slide the logo sits in" className="theme-seg">
          <SegmentedControl aria-label="Where the logo sits" className="theme-seg-control" value={place} onValueChange={value => onChange({ logoAt: value as LogoPlace })} options={LOGO_PLACE_OPTIONS} />
        </Tooltip>
      </div>
      <div className="theme-row">
        <span className="theme-row-label">On</span>
        <Tooltip label="On every slide, or only on title slides (a slide with its title alone)" className="theme-seg">
          <SegmentedControl aria-label="Which slides show the logo" className="theme-seg-control" value={on} onValueChange={value => onChange({ logoOn: value as LogoOn })} options={LOGO_ON_OPTIONS} />
        </Tooltip>
      </div>
    </>
  )
}
