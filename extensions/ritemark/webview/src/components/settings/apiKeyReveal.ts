/**
 * Sprint 147, PR 3 (decision 2, Jarmo 2 November: the saved-key eye stays). The page holds no saved key: `settings`
 * says only whether each is saved. Pressing a saved key's eye asks the host for that one key (`apiKey:reveal`), and
 * its answer (`apiKey:revealed`) fills that one field; the row drops it when the eye closes or the sheet does.
 */

export interface RevealPort {
  post: (message: { type: 'apiKey:reveal'; key: string; requestId: string }) => void
  listen: (handler: (data: unknown) => void) => () => void
}

let nextRequest = 0

/** Asks the host for one saved key; null when there is none, the name isn't one of the five, or no answer comes. */
export function requestSavedKey(key: string, port: RevealPort, timeoutMs = 5000): Promise<string | null> {
  const requestId = `reveal-${++nextRequest}`
  return new Promise((resolve) => {
    let done = false
    const finish = (value: string | null) => {
      if (done) return
      done = true
      stop()
      clearTimeout(timer)
      resolve(value)
    }
    const stop = port.listen((data) => {
      const message = data as { type?: unknown; requestId?: unknown; value?: unknown } | null
      if (!message || message.type !== 'apiKey:revealed' || message.requestId !== requestId) return
      finish(typeof message.value === 'string' && message.value ? message.value : null)
    })
    const timer = setTimeout(() => finish(null), timeoutMs)
    port.post({ type: 'apiKey:reveal', key, requestId })
  })
}

/**
 * The eye's field: what it shows after the eye closes. The saved key goes the moment it is hidden again; a key the
 * person typed over it stays (hidden), since it is theirs to save.
 */
export function afterEyeCloses(draft: string, revealed: string | null): string {
  return revealed !== null && draft === revealed ? '' : draft
}

export interface EyeState {
  draft: string
  revealed: string | null
  show: boolean
  /** The host is still answering the eye's request. */
  pending?: boolean
}

/**
 * Codex on #657: an eye's request still out when the tab is hidden (or the key removed, or the field closed) must not
 * land. Each request takes a ticket; cancelling moves the generation on, so the old ticket's answer is refused.
 */
export class RevealGate {
  private generation = 0
  begin(): number {
    return ++this.generation
  }
  cancel(): void {
    this.generation += 1
  }
  accepts(ticket: number): boolean {
    return ticket === this.generation
  }
}

/** The eye-close step: the saved key leaves the field and the row's state; a typed key stays, hidden. */
export function closeEye(state: EyeState): EyeState {
  return { draft: afterEyeCloses(state.draft, state.revealed), revealed: null, show: false }
}

/**
 * The review of #657: a shown saved key also goes when the tab is hidden (the page keeps its state while hidden) and
 * when the key is removed elsewhere, so it never sits in a field nobody is looking at.
 */
export function eyeMustClose(state: EyeState, event: { hidden: boolean; saved: boolean }): boolean {
  if (state.revealed === null && !state.show && !state.pending) return false
  return event.hidden || (!event.saved && (state.revealed !== null || Boolean(state.pending)))
}
