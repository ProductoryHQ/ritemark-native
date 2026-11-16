/**
 * Sprint 157, PR 4: the quiet lines under a copy, as the prototype's `underLines` (`prototype.html:1097-1114`, the
 * 15 November version): where it came from; changed here, with Keep it here and Update the library; the library has a
 * newer version, with Use it; both at once; changed here only, once kept; and just updated.
 */
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'

/** A copy's source, as the host reads it (`SourceState` in `src/decks/DeckLibrary.ts`). */
export interface CopySource {
  id: string
  library: boolean
  sourceName: string
  changed: boolean
  newer: boolean
  missing: boolean
}

export interface SourceLineActions {
  keepHere: () => void
  updateLibrary: () => void
  useLibrary: () => void
}

interface SourceLinesProps {
  source: CopySource
  kept: boolean
  justUpdated: boolean
  /** A library write or read is on its way: the actions wait for it. */
  busy: boolean
  actions: SourceLineActions
}

function LineAction({ label, tip, strong, busy, onClick }: { label: string; tip: string; strong?: boolean; busy: boolean; onClick: () => void }) {
  return (
    <Tooltip label={busy ? 'The Slide library is still busy with the last change' : tip}>
      <Button variant="link" className={`deck-line-action${strong ? ' is-strong' : ''}`} disabled={busy} onClick={onClick}>
        {label}
      </Button>
    </Tooltip>
  )
}

export function SourceLines({ source, kept, justUpdated, busy, actions }: SourceLinesProps) {
  if (!source.library) {
    return (
      <div className="deck-source">
        <Icon name="presentation" size={12} tone="inherit" />
        {`From ${source.sourceName}`}
      </div>
    )
  }
  const keep = <LineAction label="Keep it here" tip="Keep this change in this deck only; the library's slide stays as it is" busy={busy} onClick={actions.keepHere} />
  const update = (strong: boolean) => (
    <LineAction label="Update the library" tip="Write this slide into the library, so other decks are offered it" strong={strong} busy={busy} onClick={actions.updateLibrary} />
  )
  const useLibrary = (label: string) => (
    <LineAction label={label} tip="Put the library's version in this slide's place; its speaker notes stay" busy={busy} onClick={actions.useLibrary} />
  )
  return (
    <>
      <div className="deck-source">
        <Icon name="books" size={12} tone="inherit" />
        {`From the library · ${source.sourceName}`}
        {source.missing ? <span>· no longer in the library</span> : null}
      </div>
      {source.missing ? null : justUpdated ? (
        <div className="deck-change is-done" role="status">
          <Icon name="check" size={14} tone="inherit" />
          <span>Updated in the library. Other decks that use it will offer the new version.</span>
        </div>
      ) : source.changed && !kept ? (
        <div className="deck-change is-question">
          <span>{source.newer ? 'Changed in this deck, and the library has a newer version.' : "Changed in this deck; the library's slide is as it was."}</span>
          <span className="deck-grow" />
          {keep}
          {source.newer ? useLibrary("Use the library's") : null}
          {update(true)}
        </div>
      ) : source.changed && kept ? (
        <div className="deck-source">
          <Icon name="pencil-simple-line" size={12} tone="inherit" />
          <span>Changed here only.</span>
          {source.newer ? (
            <>
              <span>The library has a newer version:</span>
              {useLibrary('Use it')}
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {update(false)}
        </div>
      ) : source.newer ? (
        <div className="deck-change is-new">
          <span>The library has a newer version of this slide.</span>
          <span className="deck-grow" />
          <Tooltip label={busy ? 'The Slide library is still busy with the last change' : "Put the library's version in this slide's place; its speaker notes stay"}>
            <Button variant="secondary" size="sm" className="deck-use-it" disabled={busy} onClick={actions.useLibrary}>Use it</Button>
          </Tooltip>
        </div>
      ) : null}
    </>
  )
}
