/**
 * The handout's start card (Sprint 159, 16 November; the Experience lead's frame 20, the prototype's `.hstart`): "Start
 * this deck", under the first part of a deck New → Deck just made. Two ways in: ask the AI to draft it, or start from a
 * copy of an earlier deck. Which rows show, and when the card goes, is `startCardRows` (src/decks/startCard.ts).
 */
import { forwardRef, useState, type CSSProperties } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Tooltip } from '../ui/tooltip'
import { MAX_DRAFT_WORDS, START_CARD_SHOWN } from '../../../../src/decks/startCard'
import type { EarlierDeck } from '../../../../src/decks/newDeck'

interface StartCardProps {
  style: CSSProperties
  /** The AI Draft goes to, by name ("Claude"); null hides the Ask row. */
  aiName: string | null
  /** The project's earlier decks, newest first; empty hides the copy row. */
  earlier: EarlierDeck[]
  /** Draft or a copy is on its way: the rows wait for the host's answer. */
  busy: boolean
  onDraft: (words: string) => void
  onCopy: (deck: EarlierDeck) => void
  onHide: () => void
  /**
   * What is typed in "What is it for?" and whether All decks… was pressed, kept by the deck view (#917): the card under
   * the slide and the card in the handout are one card, so a switch of view keeps both.
   */
  words: string
  onWords: (words: string) => void
  all: boolean
  onAll: () => void
}

export const StartCard = forwardRef<HTMLDivElement, StartCardProps>(function StartCard({ style, aiName, earlier, busy, onDraft, onCopy, onHide, words, onWords, all, onAll }, ref) {
  const [field, setField] = useState<HTMLInputElement | null>(null)
  const shown = all ? earlier : earlier.slice(0, START_CARD_SHOWN)
  // Draft with no words asks for them: the field takes the caret, and nothing is sent.
  const draft = () => {
    if (busy) return
    if (words.trim()) onDraft(words.trim())
    else field?.focus()
  }

  return (
    // Keys typed in the card stay in it: the handout's editor and the deck's shortcuts never see them.
    <div ref={ref} className="deck-start" style={style} role="region" aria-label="Start this deck" onKeyDown={event => event.stopPropagation()}>
      <Tooltip label="Hide this">
        <Button variant="ghost" size="icon-sm" className="deck-start-x" aria-label="Hide this" onClick={onHide}>
          <Icon name="x" size={14} tone="inherit" />
        </Button>
      </Tooltip>
      <div className="deck-start-eyebrow">Start this deck</div>
      {aiName ? (
        <>
          <div className="deck-start-label"><Icon name="sparkle" size={14} tone="inherit" className="deck-start-icon" />Ask {aiName} to draft it</div>
          <div className="deck-start-ask">
            <Input
              ref={setField}
              className="deck-start-field"
              placeholder="What is it for?"
              aria-label={`What the deck is for: ${aiName} drafts it`}
              maxLength={MAX_DRAFT_WORDS}
              value={words}
              onChange={event => onWords(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  draft()
                }
              }}
            />
            <Tooltip label={`${aiName} writes the slides and the handout into this deck, from the library and the project's files`}>
              <Button className="deck-start-draft" disabled={busy} onClick={draft}>Draft</Button>
            </Tooltip>
          </div>
        </>
      ) : null}
      {earlier.length ? (
        <>
          <div className="deck-start-label"><Icon name="copy" size={14} tone="inherit" className="deck-start-icon" />Or copy an earlier deck</div>
          <div className="deck-start-earlier">
            {shown.map(deck => (
              <Tooltip key={deck.path} label={`This deck becomes a copy of ${deck.name}`}>
                <Button variant="ghost" className="deck-start-deck" disabled={busy} onClick={() => onCopy(deck)}>
                  <span className="deck-start-deck-name">{deck.name}</span>
                  <span className="deck-start-deck-where">{deck.folder} · {deck.date}</span>
                </Button>
              </Tooltip>
            ))}
            {!all && earlier.length > shown.length ? (
              <Tooltip label={`Show the other ${earlier.length - shown.length} deck${earlier.length - shown.length === 1 ? '' : 's'} here`}>
                <Button variant="ghost" className="deck-start-deck deck-start-more" onClick={onAll}>All decks…</Button>
              </Tooltip>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
})
