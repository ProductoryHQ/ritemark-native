/**
 * Home's guidance cards (Sprint 140): the ready request (experience 35, frames
 * 1, 3 and 4) and the first-week question (experience 34, frame 1). One shows
 * at a time, under Waiting for you; the host decides which and gives the words
 * (`src/guidance/`), so the page only draws them and says what the person did.
 *
 * Sprint 156 (experience 35, "With no AI ready"): with no AI ready the card's
 * main part signs in, with the sign-in icon. While the sign-in runs, the card
 * borrows the welcome's frame 2 in its own parts: the whole split button waits
 * ("Signing in…"), a quiet Cancel follows it, the note says the browser opened
 * the page, and "Did nothing open? Open the page again" is the line under the
 * row. Those words are the welcome's (`welcomeCopy.ts`).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { HomeAi, HomeAiId, HomeGuidance } from '../../../../src/projects/protocol'
import type { WelcomeProviderId } from '../../../../src/welcome/protocol'
import { Button } from '../ui/button'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { SplitButton } from '../ui/split-button'
import { Tooltip } from '../ui/tooltip'
import { KeySheet } from '../welcome/WelcomeParts'
import { COPY, OPENCODE_SET_UP_TIP, browserOpened, reopenTip, stopWaitingTip } from '../welcome/welcomeCopy'
import { send } from './homeClient'

type ReadyRequest = Extract<HomeGuidance, { card: 'ready-request' }>
type FeedbackCardState = Extract<HomeGuidance, { card: 'feedback' }>

/** Experience 19's AI icons: Claude's C, ChatGPT's logo, OpenCode's cube. */
function AiMark({ id }: { id: HomeAiId }) {
  if (id === 'claude-code') return <span className="rh-ai-c" aria-hidden="true">C</span>
  return <Icon name={id === 'codex' ? 'open-ai-logo' : 'cube'} size={14} tone="inherit" />
}

/** The welcome's ids for the AIs, for its words (`welcomeCopy.ts`). */
const WELCOME_ID: Record<HomeAiId, WelcomeProviderId> = { 'claude-code': 'claude', codex: 'chatgpt', opencode: 'opencode' }

/** An AI signing in: Ask with's row, and the card's main part while it waits (Sprint 156). */
const SIGNING_IN = 'Signing in…'

function stateWords(ai: HomeAi): string | null {
  switch (ai.state) {
    case 'sign-in': return 'Sign in'
    case 'set-up': return 'Set up'
    case 'signing-in': return SIGNING_IN
    case 'checking': return 'Checking…'
    default: return null
  }
}

/** The main part's tooltip. Sprint 156: with no AI ready, what its sign-in opens (the Experience lead, answer 3). */
export function mainTip(card: ReadyRequest): string {
  const name = card.aiName
  if (!card.aiReady) return card.ai === 'opencode' ? OPENCODE_SET_UP_TIP : `Opens ${name}’s sign-in in your browser`
  if (card.kind === 'files') return `Sends this request in a new chat with ${name}`
  if (card.kind === 'empty') return `Opens a new chat with ${name}, ready for your sentence`
  return `Gives the task on the board to ${name}`
}

/**
 * The main part's press. Sprint 156: it always goes to the host (`home/ready-request`), which sends, fills, gives the
 * sample's card, or with no AI ready signs in. The one exception is Set up OpenCode leading, which opens its key sheet
 * on the page, as Ask with's Set up does.
 */
export function pressMain(card: ReadyRequest, page: { openKeySheet(): void; startPressing(): void }): void {
  if (!card.aiReady && card.ai === 'opencode') return page.openKeySheet()
  // The sample's hand-over says what is happening while it starts (experience 35, The build checked)
  if (card.aiReady && card.kind === 'sample') page.startPressing()
  send({ type: 'home/ready-request' })
}

export function ReadyRequestCard({ card, keysResult, onKeysClosed }: { card: ReadyRequest; keysResult: { ok: boolean; message: string | null } | null; onKeysClosed: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [keySheet, setKeySheet] = useState(false)
  // Ask with opens under the whole split button, its left edge on the main button's (experience 35, frame 1)
  // The sample's hand-over takes some seconds before the board shows it in Doing: the whole button waits, caret too,
  // and is not pressed twice. The other two kinds never wait: a second press opens the chat the first one started
  // (Sprint 142 R5b; experience 35, "The split button is one button, in one tone").
  const [pressing, setPressing] = useState(false)
  useEffect(() => {
    if (!pressing) return
    const timer = setTimeout(() => setPressing(false), 30_000)
    return () => clearTimeout(timer)
  }, [pressing])
  useEffect(() => {
    if (card.problem) setPressing(false)
  }, [card.problem])
  // The sample's hand-over says what is happening while it starts (experience 35, The build checked)
  const busy = pressing ? card.busy ?? null : null
  // Sprint 156: Home's sign-in runs; once its page is open, the card has frame 2's Cancel, note and line
  const signing = card.signingIn !== null
  const waiting = card.signingIn === 'waiting'
  const provider = WELCOME_ID[card.ai]
  const splitRef = useRef<HTMLSpanElement>(null)
  const [menuOffset, setMenuOffset] = useState(0)
  const openMenu = (open: boolean) => {
    const split = splitRef.current
    const more = split?.querySelector('.rm-split-more')
    if (open && split && more) setMenuOffset(split.getBoundingClientRect().left - more.getBoundingClientRect().left)
    setMenuOpen(open)
  }
  const choose = (ai: HomeAi) => {
    if (ai.state === 'ready') send({ type: 'home/ready-request-ai', ai: ai.id })
    else if (ai.id === 'opencode' && ai.state === 'set-up') setKeySheet(true)
    else if (ai.state === 'sign-in' || ai.state === 'set-up') send({ type: 'home/sign-in', ai: ai.id })
  }
  return (
    <section className="rh-guide" aria-labelledby="rh-guide-head">
      <h3 className="rh-guide-hd" id="rh-guide-head"><Icon name={card.icon} size={16} tone="inherit" />{card.heading}</h3>
      <Tooltip label={card.hide} className="rh-guide-x">
        <Button variant="ghost" size="icon-sm" aria-label={card.hide} onClick={() => send({ type: 'home/ready-request-hide' })}>
          <Icon name="x" size={12} tone="inherit" />
        </Button>
      </Tooltip>
      <p className="rh-guide-body">{card.body}</p>
      <div className="rh-guide-go">
        <SplitButton
          className="rh-split"
          wrapperRef={splitRef}
          // The whole button waits, caret too, so a second press can't start another (answers 1 and 7)
          busy={pressing || signing}
          main={{
            label: signing ? SIGNING_IN : busy ? busy.button : card.button,
            icon: signing || busy
              ? <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin motion-reduce:animate-none" />
              : <Icon name={card.aiReady ? 'chat-circle' : 'sign-in'} size={14} tone="inherit" />,
            // The shared split button puts the whole words first: on the narrowest desk the button shows its icon
            // alone (experience 3, b7fef7b; #566)
            tooltip: mainTip(card),
            className: 'rh-split-main',
            onClick: () => pressMain(card, { openKeySheet: () => setKeySheet(true), startPressing: () => setPressing(true) }),
          }}
          menu={{
            label: 'Ask with',
            tooltip: 'Choose which AI asks',
            open: menuOpen,
            onOpenChange: openMenu,
            align: 'start',
            alignOffset: menuOffset,
            contentClassName: 'rh-askwith',
            content: (
              <>
                <div className="rh-askwith-hd" role="presentation">Ask with</div>
                {card.ais.map((ai) => {
                  const words = stateWords(ai)
                  const waits = ai.state === 'signing-in' || ai.state === 'checking'
                  return (
                    <DropdownMenuItem
                      key={ai.id}
                      disabled={waits}
                      onSelect={() => choose(ai)}
                      role="menuitemradio"
                      aria-checked={ai.id === card.ai && card.aiReady}
                      className="rh-askwith-it"
                    >
                      <span className="rh-askwith-ic"><AiMark id={ai.id} /></span>
                      <span className="rh-askwith-name">{ai.name}</span>
                      {words
                        ? <span className="rh-askwith-sub">{words}</span>
                        : ai.id === card.ai && card.aiReady ? <Icon name="check" size={14} tone="inherit" className="rh-askwith-chk" /> : null}
                    </DropdownMenuItem>
                  )
                })}
              </>
            ),
          }}
        />
        {waiting && (
          <Tooltip label={stopWaitingTip(provider)}>
            <Button variant="ghost" size="sm" className="rh-quiet" onClick={() => send({ type: 'home/cancel-sign-in' })}>{COPY.cancel}</Button>
          </Tooltip>
        )}
        <span className="rh-guide-note" role={busy || waiting ? 'status' : undefined}>{waiting ? browserOpened(provider) : busy ? busy.note : card.note}</span>
      </div>
      {waiting && (
        <div className="rh-guide-go">
          <Tooltip label={reopenTip(provider)}>
            <Button variant="ghost" size="sm" className="rh-quiet" onClick={() => send({ type: 'home/reopen-sign-in' })}>{COPY.reopen}</Button>
          </Tooltip>
        </div>
      )}
      {card.problem && <p className="rh-guide-problem" role="status">{card.problem}</p>}
      <KeySheet
        target={keySheet ? 'opencode' : null}
        keysSet={card.keysSet}
        result={keysResult}
        onClose={() => {
          setKeySheet(false)
          onKeysClosed()
        }}
        onSave={(_target, keys) => send({ type: 'home/save-keys', keys })}
      />
    </section>
  )
}

export function FeedbackCard({ card }: { card: FeedbackCardState }) {
  const [text, setText] = useState('')
  const empty = !text.trim()
  return (
    <section className="rh-guide rh-ask" aria-labelledby="rh-ask-head">
      <h3 className="rh-guide-hd" id="rh-ask-head"><Icon name="chat-centered-text" size={16} tone="inherit" />{card.heading}</h3>
      <p className="rh-guide-sub" id="rh-ask-lede">{card.lede}</p>
      <Input
        className="rh-ask-in"
        value={text}
        maxLength={1000}
        placeholder={card.placeholder}
        aria-label={card.heading}
        aria-describedby="rh-ask-lede"
        disabled={card.sending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !empty && !card.sending) send({ type: 'home/feedback-send', text })
        }}
      />
      {card.problem && <p className="rh-guide-problem rh-ask-problem" role="alert">{card.problem}</p>}
      <div className="rh-ask-acts">
        <Tooltip label={empty ? 'Write a line first' : 'Sends this line to the people who make Ritemark'}>
          <Button size="sm" disabled={empty || card.sending} onClick={() => send({ type: 'home/feedback-send', text })}>
            {card.sending ? 'Sending…' : card.problem ? 'Try again' : 'Send'}
          </Button>
        </Tooltip>
        {card.problem && (
          <Tooltip label="Opens your e-mail app with this line, to send it yourself">
            <Button variant="ghost" size="sm" className="rh-quiet" disabled={empty} onClick={() => send({ type: 'home/feedback-mail', text })}>Open in e-mail</Button>
          </Tooltip>
        )}
        <Tooltip label="Close this question for this release">
          <Button variant="ghost" size="sm" className="rh-quiet" disabled={card.sending} onClick={() => send({ type: 'home/feedback-not-now' })}>Not now</Button>
        </Tooltip>
      </div>
    </section>
  )
}

/** The one guidance card, or nothing (R2). */
export function GuidanceCard({ guidance, whatMoved }: { guidance: HomeGuidance | null; whatMoved: ReactNode }) {
  const [keysResult, setKeysResult] = useState<{ ok: boolean; message: string | null } | null>(null)
  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string; ok?: boolean; message?: string | null }>) => {
      if (event.data?.type === 'home/keys-saved') setKeysResult({ ok: Boolean(event.data.ok), message: event.data.message ?? null })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  if (!guidance) return null
  if (guidance.card === 'what-moved') return <>{whatMoved}</>
  if (guidance.card === 'ready-request') return <ReadyRequestCard card={guidance} keysResult={keysResult} onKeysClosed={() => setKeysResult(null)} />
  return <FeedbackCard card={guidance} />
}
