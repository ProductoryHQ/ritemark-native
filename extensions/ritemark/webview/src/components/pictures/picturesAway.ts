/**
 * Pictures with ChatGPT: a request whose editor went while ChatGPT made the picture (a slide left for another, Jarmo's
 * test of #800). The request goes on: the host saves the picture into `images/` as always, and it lands in the place it
 * was asked for, in the deck, whichever slide is showing then. Back on that slide, the strip is as if the person had
 * stayed: "ChatGPT is making the picture…" with Cancel while it is made, the done line with Undo and Try another once it
 * is in (`take`).
 *
 * The place gone when the picture comes (its slide deleted, the picture replaced by hand meanwhile): nothing in the
 * document changes, and the made picture stays in `images/`.
 *
 * Pure (no React, no bridge): the maker (`ChatgptPicture.tsx`) hands requests here and passes the host's answers in.
 */
import type { MakerPhase, PictureAsk, PicturePlaceRef } from './chatgptPictureState'

/** A made picture in its place while its editor was gone: where it is now, and what the strip's Undo does. */
export interface AwayLanding {
  place: PicturePlaceRef
  undo: () => void
}

export interface AwayRequest {
  requestId: string
  /** The editor that takes the request back when it is shown again: a deck's slide. */
  key: string
  ask: PictureAsk
  description: string
  /** The made picture into its place in the document, or null when the place is gone (then nothing changed). */
  land: (made: { path: string; url: string }) => AwayLanding | null
}

type Outcome = { state: 'making' } | { state: 'done'; landing: AwayLanding } | { state: 'failed'; problem: string } | { state: 'sign-in' }

interface Entry extends AwayRequest {
  outcome: Outcome
}

export class PicturesAway {
  private entries: Entry[] = []

  /** A request still being made, let go by its editor. */
  hand(request: AwayRequest): void {
    // One request per place: an older one for the same editor has been answered or taken back already.
    this.entries = this.entries.filter(entry => entry.key !== request.key || entry.outcome.state === 'making')
    this.entries.push({ ...request, outcome: { state: 'making' } })
  }

  /** The host's `picture/status`: true when it answered a request held here. */
  status(message: { requestId?: unknown; state?: unknown; problem?: unknown; path?: unknown; url?: unknown }): boolean {
    const entry = this.entries.find(item => item.requestId === message.requestId)
    if (!entry || entry.outcome.state !== 'making') return false
    if (message.state === 'made' && typeof message.path === 'string' && typeof message.url === 'string') {
      let landing: AwayLanding | null = null
      try {
        landing = entry.land({ path: message.path, url: message.url })
      } catch (error) {
        console.warn('[pictures] The made picture could not be placed:', error)
      }
      // The place is gone: the document stays as it is, and the picture stays in images/.
      if (!landing) this.drop(entry)
      else entry.outcome = { state: 'done', landing }
    } else if (message.state === 'failed') {
      entry.outcome = { state: 'failed', problem: typeof message.problem === 'string' ? message.problem : 'ChatGPT couldn\'t make the picture. Try again.' }
    } else if (message.state === 'sign-in') {
      entry.outcome = { state: 'sign-in' }
    } else {
      this.drop(entry)
    }
    return true
  }

  /**
   * Back on the editor: its request, as the maker's state there, with its place as that editor finds it (`find`), and
   * no longer held here. Null when there is none, or its place isn't in that editor (a request still being made then
   * stays here, and lands in the document when it comes).
   */
  take(key: string, find: (place: PicturePlaceRef) => PicturePlaceRef | null): MakerPhase | null {
    const entry = [...this.entries].reverse().find(item => item.key === key)
    if (!entry) return null
    const { outcome } = entry
    const place = find(outcome.state === 'done' ? outcome.landing.place : entry.ask.place)
    if (!place) {
      if (outcome.state !== 'making') this.drop(entry)
      return null
    }
    this.drop(entry)
    const ask = { ...entry.ask, place }
    if (outcome.state === 'making') return { phase: 'making', ask, description: entry.description, requestId: entry.requestId }
    if (outcome.state === 'done') return { phase: 'done', ask, description: entry.description, undo: outcome.landing.undo }
    if (outcome.state === 'failed') return { phase: 'failed', ask, description: entry.description, problem: outcome.problem }
    return { phase: 'sign-in', ask }
  }

  /** The requests held for an editor (tests). */
  heldFor(key: string): number {
    return this.entries.filter(entry => entry.key === key).length
  }

  private drop(entry: Entry): void {
    this.entries = this.entries.filter(item => item !== entry)
  }
}
