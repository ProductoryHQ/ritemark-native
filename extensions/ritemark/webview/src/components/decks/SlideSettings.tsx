/**
 * Sprint 157 (README frame 4): Settings opens beside the slide, not over it, so a change is seen as it is made.
 * Layout (nine kinds as small pictures), the look of a row of boxes, Picture (None, Left, Right, Behind) and Skip
 * slide. A change of kind keeps the words (`convertKind`). Built from the shared controls: the segmented control (its
 * picture variant for the layouts and the picture places) and the switch.
 *
 * An exercise slide also has Label (16 November): its pill's words, as on the slide, with the default as the
 * placeholder. Emptied, the slide has no pill (`tag: ""`); words typed here bring it back.
 */
import { useRef, type ReactNode } from 'react'
import { EXERCISE_TAG, exerciseTagOf, type SlideData } from '../../../../src/decks/deckFormat'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SegmentedControl } from '../ui/segmented-control'
import { Switch } from '../ui/switch'
import { Tooltip } from '../ui/tooltip'
import { useDismissOnOutside } from '../../lib/dismissOnOutside'
import { oneLine, setPath, undoKeyOf } from './slide/slideEdits'

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
  /** Cmd+Z (redo: Cmd+Shift+Z, Cmd+Y) in a field: the deck's undo, as on the stage, not the field's own. */
  onUndo: (redo: boolean) => void
  style?: React.CSSProperties
  /** The gear that opened Settings: a press on it toggles them, and Esc or Close gives it the focus back. */
  trigger?: () => HTMLElement | null | undefined
}

export function SlideSettings({ number, kind, data, onKind, onChange, onClose, onUndo, style, trigger }: SlideSettingsProps) {
  const skipId = `deck-skip-${number}`
  const tagId = `deck-tag-${number}`
  // 17 November (Jarmo): a press outside closes Settings, and Esc does (the focus back on the gear); choosing a layout
  // or a picture place is inside, so Settings stay open while the change is seen.
  const ref = useRef<HTMLElement>(null)
  const dismiss = useDismissOnOutside(ref, onClose, { trigger })
  return (
    <section ref={ref} className="deck-settings" style={style} aria-label={`Settings of slide ${number}`}>
      <header className="deck-settings-head">
        <span>Slide {number}</span>
        <Tooltip label="Close the settings">
          <Button variant="ghost" size="icon-sm" aria-label="Close the settings" onClick={dismiss}>
            <Icon name="x" size={14} tone="inherit" />
          </Button>
        </Tooltip>
      </header>
      <div className="deck-settings-k">Layout</div>
      <SegmentedControl
        aria-label="Layout"
        variant="picture"
        className="deck-settings-lays"
        value={kind}
        onValueChange={onKind}
        options={LAYOUTS}
      />
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
      {kind === 'exercise' ? (
        <div className="deck-settings-row deck-settings-tag">
          <Label htmlFor={tagId}>Label</Label>
          <Input
            id={tagId}
            className="deck-settings-field"
            placeholder={EXERCISE_TAG}
            value={exerciseTagOf(data)}
            onChange={event => {
              // Through the pill's own rule (`setPath`): words as they were write nothing.
              const next = setPath(data, 'tag', oneLine(event.target.value))
              if (next !== data) onChange({ tag: next.tag })
            }}
            onKeyDown={event => {
              const step = undoKeyOf({ key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, isComposing: event.nativeEvent.isComposing })
              if (!step) return
              event.preventDefault()
              onUndo(step === 'redo')
            }}
          />
        </div>
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
      <div className="deck-settings-sep" />
      <div className="deck-settings-row">
        <Label htmlFor={skipId}>Skip slide</Label>
        <Switch id={skipId} checked={data.skip === true} onCheckedChange={skip => onChange({ skip: skip || undefined })} />
      </div>
    </section>
  )
}
