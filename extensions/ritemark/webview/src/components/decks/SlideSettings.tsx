/**
 * Sprint 157 (README frame 4): the slide's settings, seen on the slide as they change. Since 17 November a popover that
 * the slide's own menu opens, "Slide settings…" (Jarmo, 17 November: "slaidi settings peaks olema siin: mitte kuskil
 * ülal tööriistaribas"): the thumbnail's ⋯ or right-click, the handout part number's ⋯ and the end of the slide's own
 * right-click menu, anchored beside where it came from. The gear in the bar is gone. Its order (README, "Nothing around
 * the slide"): the library section, then Picture. A table's rows and columns are
 * added with the table's own + bars and grips (experience 48), so Settings no longer has Add a row and Add a column.
 * Skip slide is only in the menu, so it isn't in two places.
 * Layout (nine kinds as small pictures), the look of a row of boxes, Picture (None, Left, Right, Behind) and Skip
 * slide. A change of kind keeps the words (`convertKind`). Built from the shared controls: the segmented control (its
 * picture variant for the layouts and the picture places) and the switch.
 *
 * Sprint 164 PR 3 (Jarmo's yes by name, 19 November, "kinnitan sprindi 164 koos eemaldustega"): the Label row (16
 * November, a Steps pill's words) is gone. The pill is a Label block of its own on the slide, added from the / menu.
 *
 * The popover (DeckView) closes on a press outside and on Esc and gives the focus back to where the menu was opened.
 * The lines that sat under the slide come first here (`about`, `SlideAbout`): where a library copy came from with its
 * actions, and the words a layout keeps for others; then a line, then the slide's own settings.
 *
 * The popover holds only the slide's own settings. From 16 to 17 November its last section was the deck's own choice,
 * Card or Borderless ("This deck · all 15 slides"); since Sprint 162 that choice lives in the Theme menu on the deck's
 * bar (`ThemeMenu.tsx`, step-3-themes.md), with the deck's theme, and writes the deck's front matter the same way.
 */
import type { ReactNode } from 'react'
import { isBlockSlide, parseFrom, type SlideData } from '../../../../src/decks/deckFormat'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { SegmentedControl } from '../ui/segmented-control'
import { Tooltip } from '../ui/tooltip'

/** A small picture of a layout: a few bars, as the prototype's `.lay .pic`. */
function Bars({ bars }: { bars: Array<[number, number, number, number]> }) {
  return (
    <span className="deck-lay-pic" aria-hidden="true">
      {bars.map(([left, top, width, height], index) => <i key={index} style={{ left, top, width, height }} />)}
    </span>
  )
}

const LAYOUTS: Array<{ value: string; label: string; picture: ReactNode }> = [
  { value: 'title', label: 'Title', picture: <Bars bars={[[7, 13, 32, 4], [7, 20, 20, 3]]} /> },
  { value: 'points', label: 'Points', picture: <Bars bars={[[6, 6, 20, 4], [6, 14, 36, 2], [6, 20, 30, 2], [6, 26, 34, 2]]} /> },
  { value: 'boxes', label: 'Boxes', picture: <Bars bars={[[6, 6, 20, 4], [6, 14, 8, 16], [16, 14, 8, 16], [26, 14, 8, 16], [36, 14, 8, 16]]} /> },
  { value: 'columns', label: 'Columns', picture: <Bars bars={[[6, 6, 20, 4], [6, 14, 18, 16], [26, 14, 18, 16]]} /> },
  { value: 'statement', label: 'Statement', picture: <Bars bars={[[8, 14, 34, 5], [13, 23, 24, 2]]} /> },
  { value: 'section', label: 'Section', picture: <Bars bars={[[6, 6, 9, 9], [6, 21, 30, 4]]} /> },
  { value: 'exercise', label: 'Exercise', picture: <Bars bars={[[6, 5, 12, 4], [6, 13, 4, 4], [12, 13.5, 24, 3], [6, 20, 4, 4], [12, 20.5, 20, 3], [6, 27, 4, 4], [12, 27.5, 26, 3]]} /> },
  { value: 'picture', label: 'Picture', picture: <Bars bars={[[6, 5, 20, 4], [6, 12, 38, 18]]} /> },
  { value: 'table', label: 'Table', picture: <Bars bars={[[6, 5, 20, 4], [6, 12, 38, 4], [6, 18, 38, 2], [6, 23, 38, 2], [6, 28, 38, 2]]} /> },
]

const LOOKS = [
  { value: 'boxes', label: 'Boxes' },
  { value: 'steps', label: 'Steps' },
  { value: 'arrows', label: 'Arrows' },
  { value: 'line', label: 'Line' },
]

const PICTURES: Array<{ value: string; label: string; picture: ReactNode }> = [
  { value: 'none', label: 'None', picture: <span className="deck-pic-pic" aria-hidden="true" /> },
  { value: 'left', label: 'Left', picture: <span className="deck-pic-pic" aria-hidden="true"><i style={{ left: 0, top: 0, bottom: 0, width: '40%' }} /></span> },
  { value: 'right', label: 'Right', picture: <span className="deck-pic-pic" aria-hidden="true"><i style={{ right: 0, top: 0, bottom: 0, width: '40%' }} /></span> },
  { value: 'behind', label: 'Behind', picture: <span className="deck-pic-pic" aria-hidden="true"><i style={{ inset: 0 }} /></span> },
]

interface SlideSettingsProps {
  number: number
  kind: string
  data: SlideData
  onKind: (kind: string) => void
  /** The settings changed, as a patch on the slide's data (an undefined value takes the line out). */
  onChange: (patch: Partial<SlideData>) => void
  onClose: () => void
  /** The lines about the slide, first (`SlideAbout`); none, and the settings start at once. */
  about?: ReactNode
}

/** The library's topic or the deck a copy came from, as its plain line before the host has read the copy's state. */
function sourceLine(from: string | undefined): { library: boolean; name: string } | null {
  const source = parseFrom(from)
  if (!source) return null
  const name = source.path.split('/').pop()?.replace(/\.deck\.md$/i, '') ?? source.path
  return { library: /^Slide library\//.test(source.path), name }
}

interface SlideAboutProps {
  data: SlideData
  /** The copy's lines with their actions, once the host has read its state (`SourceLines`); else the plain line. */
  sourceLines?: ReactNode
  /** The words this layout keeps for others (`hiddenNote`), or ''. */
  hidden: string
}

/** The top of Settings: what sat under the slide before 17 November. Null when there is nothing to say. */
export function SlideAbout({ data, sourceLines, hidden }: SlideAboutProps) {
  const source = sourceLine(data.from)
  if (!sourceLines && !source && !hidden) return null
  return (
    <div className="deck-settings-about">
      {sourceLines ?? (source ? (
        <div className="deck-source">
          <Icon name={source.library ? 'cards-three' : 'presentation'} size={12} tone="inherit" />
          {source.library ? `From the library · ${source.name}` : `From ${source.name}`}
        </div>
      ) : null)}
      {hidden ? (
        <div className="deck-source">
          <Icon name="eye-slash" size={12} tone="inherit" />
          {hidden}
        </div>
      ) : null}
    </div>
  )
}

export function SlideSettings({ number, kind, data, onKind, onChange, onClose, about }: SlideSettingsProps) {
  return (
    <section aria-label={`Settings of slide ${number}`}>
      <header className="deck-settings-head">
        <span>Slide {number}</span>
        <Tooltip label="Close the settings">
          <Button variant="ghost" size="icon-sm" aria-label="Close the settings" onClick={onClose}>
            <Icon name="x" size={14} tone="inherit" />
          </Button>
        </Tooltip>
      </header>
      {about ? (
        <>
          {about}
          <div className="deck-settings-sep" />
        </>
      ) : null}
      {/* A block slide (Sprint 161) has no layout: its blocks are its layout (README frame 26). */}
      {isBlockSlide(kind) ? null : (
        <>
          <div className="deck-settings-k">Layout</div>
          <SegmentedControl
            aria-label="Layout"
            variant="picture"
            className="deck-settings-lays"
            value={kind}
            onValueChange={onKind}
            options={LAYOUTS}
          />
        </>
      )}
      {kind === 'boxes' ? (
        <>
          <div className="deck-settings-k">Look</div>
          <SegmentedControl
            aria-label="Look of the boxes"
            className="w-full [&>label]:flex-1 [&>label>span]:w-full [&>label>span]:text-center"
            value={data.look || 'boxes'}
            onValueChange={look => onChange({ look: look === 'boxes' ? undefined : look })}
            options={LOOKS}
          />
        </>
      ) : null}
      {kind !== 'picture' ? (
        <>
          <div className="deck-settings-k">Picture</div>
          <SegmentedControl
            aria-label="Picture"
            variant="picture"
            className="deck-settings-pics"
            value={data.picture || 'none'}
            onValueChange={picture => onChange({ picture: picture === 'none' ? undefined : picture })}
            options={PICTURES}
          />
        </>
      ) : null}
    </section>
  )
}
