/**
 * Sprint 162 PR 4 (step-3-themes.md, "Logo"; the prototype's `.tdrop` and `.tlogo`): the theme tab's Logo rows.
 *
 *   - No logo: one place to drop a picture on, or to choose a file (an SVG or a PNG). The host checks it, copies it
 *     beside the theme file and names it in the draft (`ThemePages.takeLogo`).
 *   - A logo: the picture on the theme's own background, with Replace and Remove; then Where (top left, top right or
 *     bottom right) and On (every slide, or the title slides only), each one field line in the draft.
 *   - A logo whose file is missing (or can't be the logo): the line says so, with Choose a file… and Remove; the
 *     slides draw no logo meanwhile.
 *   - A second version for the other ground (18 November): under the logo, "Add a version for light slides", on a dark
 *     theme only (option (a); a theme turned light keeps it, not shown), takes a second file the same way (drop or choose, the same checks,
 *     copied beside the theme). Then it is a box of its own on its ground, with Replace and Remove, and each box says
 *     which slides it is for. A Card deck draws the one for its theme's ground, a Borderless deck the light-slide one.
 *
 * The picture is always an `<img>`: an SVG logo is never put into the tab as markup.
 */
import { useState, type DragEvent } from 'react'
import { BUILT_IN_THEME, DEFAULT_LOGO_ON, DEFAULT_LOGO_PLACE, groundOf, offersSecondLogo, otherGround, secondLogoGround, type DeckTheme, type LogoGround, type LogoEdge, type LogoOn, type LogoSide, logoEdgeOf, logoPlaceOf, logoSideOf } from '../../../../../src/decks/deckTheme'
import { SECOND_LOGO_FIELDS, type ThemeChanges } from '../../../../../src/decks/themeFile'
import type { ThemeLogoState } from '../../../../../src/decks/themeProtocol'
import { LOGO_TOO_LARGE, logoKindOfName, MAX_LOGO_BYTES } from '../../../../../src/decks/themeLogo'
import { sendToExtension } from '../../../bridge'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { SegmentedControl } from '../../ui/segmented-control'
import { Tooltip } from '../../ui/tooltip'

/** Sprint 167 PR 1: Where is two segments, Top | Bottom and Left | Right, so any of the four corners can be chosen. */
export const LOGO_EDGE_OPTIONS: Array<{ value: LogoEdge; label: string }> = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
]
export const LOGO_SIDE_OPTIONS: Array<{ value: LogoSide; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
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
function sendLogoFile(file: File, second: boolean, onWrong: (text: string) => void) {
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
    const filename = file.name.split(/[\\/]/).pop() || `logo.${mime === 'image/png' ? 'png' : 'svg'}`
    sendToExtension('theme/logo-file', { dataUrl: `data:${mime};base64,${btoa(binary)}`, filename, ...(second ? { second: true } : {}) })
  }
  reader.onerror = () => onWrong('That file could not be read.')
  reader.readAsArrayBuffer(file)
}

/** The words for the slides a ground's logo is for. */
export function groundWords(ground: LogoGround): string {
  return ground === 'light' ? 'light slides' : 'dark slides'
}

/**
 * The ground a logo's picture is shown on in the tab: the theme's own background for its own ground, else white for
 * light slides, or Evening's blue for dark ones.
 */
export function logoBoxGround(theme: Pick<DeckTheme, 'bg'>, ground: LogoGround): string {
  if (groundOf(theme.bg) === ground) return theme.bg
  return ground === 'light' ? '#FFFFFF' : BUILT_IN_THEME.bg
}

/** A place to drop a picture on, with its handlers; `second` says which of the two logos it takes. */
function useLogoDrop(second: boolean) {
  const [over, setOver] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const choose = () => { setWrong(null); sendToExtension('theme/choose-logo', second ? { second: true } : {}) }
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
      sendLogoFile(file, second, setWrong)
    },
  }
  return { over, wrong, setWrong, choose, drop }
}

interface LogoBoxProps {
  /** The picture's file, and its address in the tab: none, the file's name with a warning. */
  file: string
  url: string | null
  alt: string
  /** The ground behind the picture. */
  ground: string
  /** "For light slides", when the theme has both versions. */
  caption: string | null
  replaceTip: string
  removeTip: string
  onRemove: () => void
  dropping: ReturnType<typeof useLogoDrop>
}

/** One logo's box: the picture on its ground (or its missing file's name), with Replace and Remove. */
function LogoBox({ file, url, alt, ground, caption, replaceTip, removeTip, onRemove, dropping }: LogoBoxProps) {
  return (
    <div className={`theme-logo-box${caption ? ' has-caption' : ''}${dropping.over ? ' is-over' : ''}${url ? '' : ' is-missing'}`} style={url ? { background: ground } : undefined} {...dropping.drop}>
      {url ? (
        <img className="theme-logo-picture" src={url} alt={alt} draggable={false} />
      ) : (
        <span className="theme-logo-gone">
          <Icon name="warning" size={14} tone="inherit" />
          <span>{file}</span>
        </span>
      )}
      <span className="flex-1" />
      {caption ? <span className="theme-logo-for">{caption}</span> : null}
      <Tooltip label={replaceTip}>
        <Button variant="ghost" size="compact" className="theme-logo-act" onClick={dropping.choose}>{url ? 'Replace' : 'Choose a file…'}</Button>
      </Tooltip>
      <Tooltip label={removeTip}>
        <Button variant="ghost" size="compact" className="theme-logo-act is-quiet" onClick={() => { dropping.setWrong(null); onRemove() }}>Remove</Button>
      </Tooltip>
    </div>
  )
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
  const main = useLogoDrop(false)
  const extra = useLogoDrop(true)

  if (!theme.logo) {
    return (
      <>
        <Tooltip label="Choose an SVG or a PNG picture, or drop one here. It's copied beside the theme file." className="flex w-full">
          <Button variant="ghost" className={`theme-logo-drop${main.over ? ' is-over' : ''}`} onClick={main.choose} {...main.drop}>
            <Icon name="image" size={20} tone="inherit" />
            <span>Drop a logo here, or <b>choose a file</b></span>
          </Button>
        </Tooltip>
        {main.wrong ? <p className="theme-logo-problem" role="alert">{main.wrong}</p> : null}
      </>
    )
  }

  const place = theme.logo.place ?? DEFAULT_LOGO_PLACE
  const on = theme.logo.on ?? DEFAULT_LOGO_ON
  const problem = main.wrong ?? logo?.problem ?? null
  // The second version: the one the theme names, or the one it can add, for the ground the theme isn't on.
  const second = theme.logo.second
  const secondGround = secondLogoGround(theme)
  const secondState = second && logo?.second?.file === second.file ? logo.second : null
  const secondProblem = extra.wrong ?? secondState?.problem ?? null
  // Only a dark theme offers or shows it (option (a)); a theme turned light keeps its line and file, not shown.
  const offered = offersSecondLogo(theme)
  return (
    <>
      <LogoBox
        file={theme.logo.file}
        url={logo?.url ?? null}
        alt={`${theme.name}'s logo`}
        ground={second && offered ? logoBoxGround(theme, otherGround(second.ground)) : ground}
        caption={second && offered ? `For ${groundWords(otherGround(second.ground))}` : null}
        replaceTip="Choose another SVG or PNG picture, or drop one here"
        removeTip={second && offered ? 'Take the logo off the theme, both versions; the pictures stay beside the theme file' : 'Take the logo off the theme; the picture stays beside the theme file'}
        onRemove={() => onChange({ logo: null })}
        dropping={main}
      />
      {problem ? <p className="theme-logo-problem" role="status">{problem}</p> : null}
      {!offered ? null : second ? (
        <LogoBox
          file={second.file}
          url={secondState?.url ?? null}
          alt={`${theme.name}'s logo for ${groundWords(second.ground)}`}
          ground={logoBoxGround(theme, second.ground)}
          caption={`For ${groundWords(second.ground)}`}
          replaceTip={`Choose another SVG or PNG picture for ${groundWords(second.ground)}, or drop one here`}
          removeTip="Take this version off the theme, so the other is used on every slide; the picture stays beside the theme file"
          onRemove={() => onChange({ [SECOND_LOGO_FIELDS[second.ground]]: null })}
          dropping={extra}
        />
      ) : (
        <Tooltip label="A version that reads on white, for a Borderless deck. Choose an SVG or a PNG picture, or drop one here" className="flex w-full">
          <Button variant="ghost" className={`theme-logo-add${extra.over ? ' is-over' : ''}`} onClick={extra.choose} {...extra.drop}>
            <Icon name="plus" size={14} tone="inherit" />
            <span>Add a version for {groundWords(secondGround)}</span>
          </Button>
        </Tooltip>
      )}
      {offered && secondProblem ? <p className="theme-logo-problem" role="status">{secondProblem}</p> : null}
      <div className="theme-row">
        <span className="theme-row-label">Where</span>
        <div className="theme-seg-pair">
          <Tooltip label="The logo at the top of the slide, or at the bottom" className="theme-seg">
            <SegmentedControl aria-label="The logo at the top or the bottom" className="theme-seg-control" value={logoEdgeOf(place)} onValueChange={value => onChange({ logoAt: logoPlaceOf(value as LogoEdge, logoSideOf(place)) })} options={LOGO_EDGE_OPTIONS} />
          </Tooltip>
          <Tooltip label="The logo on the left of the slide, or on the right" className="theme-seg">
            <SegmentedControl aria-label="The logo on the left or the right" className="theme-seg-control" value={logoSideOf(place)} onValueChange={value => onChange({ logoAt: logoPlaceOf(logoEdgeOf(place), value as LogoSide) })} options={LOGO_SIDE_OPTIONS} />
          </Tooltip>
        </div>
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
