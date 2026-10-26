/**
 * Home's guidance cards (Sprint 140): the ready request (experience 35, frames
 * 1, 3 and 4) and the first-week question (experience 34, frame 1). One shows
 * at a time, under Waiting for you; the host decides which and gives the words
 * (`src/guidance/`), so the page only draws them and says what the person did.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { HomeAi, HomeAiId, HomeGuidance } from '../../../../src/projects/protocol'
import { Button } from '../ui/button'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { SplitButton } from '../ui/split-button'
import { Tooltip } from '../ui/tooltip'
import { KeySheet } from '../welcome/WelcomeParts'
import { send } from './homeClient'

type ReadyRequest = Extract<HomeGuidance, { card: 'ready-request' }>
type FeedbackCardState = Extract<HomeGuidance, { card: 'feedback' }>

/** Experience 19's AI icons: Claude's C, ChatGPT's logo, OpenCode's cube. */
function AiMark({ id }: { id: HomeAiId }) {
  if (id === 'claude-code') return <span className="rh-ai-c" aria-hidden="true">C</span>
  return <Icon name={id === 'codex' ? 'open-ai-logo' : 'cube'} size={14} tone="inherit" />
}

function stateWords(ai: HomeAi): string | null {
  switch (ai.state) {
    case 'sign-in': return 'Sign in'
    case 'set-up': return 'Set up'
    case 'signing-in': return 'Signing in…'
    case 'checking': return 'Checking…'
    default: return null
  }
}

function mainTip(card: ReadyRequest, name: string): string {
  if (!card.aiReady) return 'Sign in to an AI first'
  if (card.kind === 'files') return `Sends this request in a new chat with ${name}`
  if (card.kind === 'empty') return `Opens a new chat with ${name}, ready for your sentence`
  return `Gives the task on the board to ${name}`
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
  const splitRef = useRef<HTMLSpanElement>(null)
  const [menuOffset, setMenuOffset] = useState(0)
  const openMenu = (open: boolean) => {
    const split = splitRef.current
    const more = split?.querySelector('.rm-split-more')
    if (open && split && more) setMenuOffset(split.getBoundingClientRect().left - more.getBoundingClientRect().left)
    setMenuOpen(open)
  }
  const chosen = card.ais.find((ai) => ai.id === card.ai)
  const name = chosen?.name ?? 'Claude'
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
          busy={pressing}
          main={{
            label: busy ? busy.button : card.button,
            icon: busy
              ? <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin motion-reduce:animate-none" />
              : <Icon name="chat-circle" size={14} tone="inherit" />,
            tooltip: mainTip(card, name),
            className: 'rh-split-main',
            onClick: () => {
              if (!card.aiReady) return openMenu(true)
              if (card.kind === 'sample') setPressing(true)
              send({ type: 'home/ready-request' })
            },
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
                  const signingIn = ai.state === 'signing-in' || ai.state === 'checking'
                  return (
                    <DropdownMenuItem
                      key={ai.id}
                      disabled={signingIn}
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
        <span className="rh-guide-note" role={busy ? 'status' : undefined}>{busy ? busy.note : card.note}</span>
      </div>
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
