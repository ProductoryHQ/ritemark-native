/**
 * Sprint 159 PR 4 (experience 46, frame 6): Publish on the deck's bar, 2.2's Publish on the handout page the host
 * writes beside the deck.
 *
 *  - Hidden until Publish can be reached (the flag on and the whole-window sheet there), as the browser bar's is.
 *  - Unpublished: Publish. Published: the chip, "Published" or "Published · changed", whose menu has See online, Copy
 *    link, Update the page (only after a public change) and Unpublish. Publishing… and Unpublishing… while they run.
 *  - Publish and Update the page send each slide's fit as the strip's thumbnails measured it (`data-step`, numbers
 *    only), so the page's slides fit as the deck view's do.
 *
 * The host keeps the state (`deck/page-state`); this only draws it and asks.
 */
import { useEffect, useState } from 'react'
import type { DeckPageAction, DeckPageState } from '../../../../src/decks/deckProtocol'
import { onMessage, sendToExtension } from '../../bridge'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'

/** Each slide's fit as its thumbnail measured it, by its place in the deck; 0 where there is no thumbnail to ask. */
export function measuredSteps(count: number, root: ParentNode = document): number[] {
  const steps = Array.from({ length: count }, () => 0)
  root.querySelectorAll<HTMLElement>('.deck-strip [data-thumb]').forEach(thumb => {
    const index = Number(thumb.getAttribute('data-thumb'))
    const step = Number(thumb.querySelector('.deck-slide')?.getAttribute('data-step'))
    if (Number.isInteger(index) && index >= 0 && index < count && Number.isInteger(step)) steps[index] = Math.max(0, Math.min(3, step))
  })
  return steps
}

function isState(value: unknown): value is DeckPageState {
  const state = value as DeckPageState | null
  return !!state && typeof state.ready === 'boolean' && typeof state.changed === 'boolean'
    && ['unpublished', 'publishing', 'published', 'unpublishing'].includes(state.kind)
}

export function DeckPublish({ count, onNotice }: { count: number; onNotice: (text: string) => void }) {
  const [state, setState] = useState<DeckPageState | null>(null)

  useEffect(() => {
    const stop = onMessage(message => {
      if (message.type === 'deck/page-state' && isState(message.state)) setState(message.state)
      if (message.type === 'deck/page-notice' && typeof message.text === 'string') onNotice(message.text)
    })
    sendToExtension('deck/page-state')
    return stop
  }, [onNotice])

  return (
    <DeckPublishControl
      state={state}
      onPublish={() => sendToExtension('deck/publish', { steps: measuredSteps(count) })}
      onAction={action => sendToExtension('deck/page-action', { action })}
    />
  )
}

/** The control for a state: drawn by itself, so each state can be rendered and checked. */
export function DeckPublishControl({ state, onPublish: publish, onAction: act }: {
  state: DeckPageState | null
  onPublish: () => void
  onAction: (action: DeckPageAction) => void
}) {
  if (!state?.ready) return null

  if (state.kind === 'unpublished') {
    return (
      <Tooltip label="Publish the slides and their handout as a web page">
        <Button variant="toolbar" size="compact" className="deck-publish" onClick={publish}>
          <Icon name="globe" size={14} tone="inherit" />
          Publish
        </Button>
      </Tooltip>
    )
  }

  if (state.kind === 'publishing' || state.kind === 'unpublishing') {
    const publishing = state.kind === 'publishing'
    return (
      <Tooltip label={publishing ? 'The page is going online' : 'The page is being taken down'}>
        <Button variant="toolbar" size="compact" className="deck-publish-chip" disabled>
          <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin" />
          {publishing ? 'Publishing…' : 'Unpublishing…'}
        </Button>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <Tooltip label={state.changed ? 'The deck changed since it was published: update the page from here' : 'The page is online: see it, copy its link or take it down'}>
        <DropdownMenuTrigger asChild>
          <Button variant="toolbar" size="compact" className="deck-publish-chip">
            <Icon name="globe" size={14} tone="inherit" />
            {state.changed ? 'Published · changed' : 'Published'}
            <Icon name="caret-down" size={12} tone="inherit" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => act('see-online')}>
          <Icon name="arrow-square-out" size={14} tone="inherit" />
          See online
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => act('copy-link')}>
          <Icon name="link-simple" size={14} tone="inherit" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!state.changed} onSelect={publish}>
          <Icon name="arrows-clockwise" size={14} tone="inherit" />
          Update the page
          {state.changed ? null : <span className="ml-auto pl-3 text-[12px] text-ink-muted">No changes</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => act('unpublish')}>
          <Icon name="x-circle" size={14} tone="inherit" />
          Unpublish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
