/**
 * AgentSplitButton — every board action that starts agent work (Give to,
 * Review with, Retry with, Send to): the label names the agent, the caret
 * picks Claude Code, ChatGPT or OpenCode, and a choice becomes the board's
 * default (Jarmo, 2026-10-12; design.md D10).
 *
 * Sprint 142 (R5c, #557): one button, in one tone (framework §3; ui/split-button.tsx).
 * Disabled is the whole button's: while a press is pending, a hand-over is
 * sent, a review runs, or no agent is ready. When the chosen agent isn't ready
 * but another is, the main part opens the agent menu instead of being switched
 * off on its own (Q2), as Home's ready request does with no AI ready.
 */

import { useState } from 'react'
import type { AgentId } from '../../../../src/agent/types'
import type { BoardRuntimeView } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { SplitButton } from '../ui/split-button'

const FULL_NAMES: Record<AgentId, string> = { 'claude-code': 'Claude Code', codex: 'ChatGPT', opencode: 'OpenCode' }

/** The short reason an agent cannot take work, for its menu row. */
function unavailableWords(runtime: BoardRuntimeView): string {
  switch (runtime.state) {
    case 'needs-auth': return 'Sign in required'
    case 'auth-in-progress': return 'Signing in…'
    case 'needs-configuration': return 'Not set up'
    case 'not-installed': return 'Not installed'
    case 'checking': return 'Checking…'
    case 'disabled': return 'Turned off'
    default: return 'Unavailable'
  }
}

/**
 * The button's state from the board's agents (pure, tested): the whole button off, or on with its main part either
 * running the chosen agent or, when that one isn't ready and another is, opening the menu; and the main part's tooltip.
 * A chosen agent that isn't ready keeps its own reason after the generic sentence (Sprint 142 QA N2), as before R5c.
 */
export function agentSplitState(input: {
  runtimes: (Pick<BoardRuntimeView, 'id' | 'label' | 'usable'> & { message?: string | null })[]
  selected: AgentId
  disabled: boolean
  disabledReason?: string
  tip: (agent: string) => string
}): { disabled: boolean; mainOpensMenu: boolean; mainTip: string; name: string; anyUsable: boolean } {
  const current = input.runtimes.find((runtime) => runtime.id === input.selected)
  const name = current?.label ?? 'agent'
  const anyUsable = input.runtimes.some((runtime) => runtime.usable)
  const usable = Boolean(current?.usable)
  const disabled = Boolean(input.disabledReason) || input.disabled || !anyUsable
  const mainOpensMenu = !disabled && !usable
  const mainTip = input.disabledReason
    ? input.disabledReason
    : !anyUsable
      ? 'Set up Claude, ChatGPT or OpenCode in the AI sidebar first'
      : usable
        ? input.tip(name)
        : current?.message
          ? `${name} is not ready. Choose another agent. ${current.message}`
          : `${name} is not ready. Choose another agent.`
  return { disabled, mainOpensMenu, mainTip, name, anyUsable }
}

export function AgentSplitButton({
  verb,
  label,
  runtimes,
  selected,
  onRun,
  tip,
  variant = 'default',
  disabled = false,
  disabledReason,
  className,
}: {
  verb: string
  /** Replaces "{verb} {Agent}" (e.g. "Sending to Claude…"). */
  label?: string
  runtimes: BoardRuntimeView[]
  selected: AgentId
  onRun: (runtimeId: AgentId) => void
  tip: (agent: string) => string
  variant?: 'default' | 'outline'
  disabled?: boolean
  /** Turns the button off and says why in its tooltip. */
  disabledReason?: string
  className?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const state = agentSplitState({ runtimes, selected, disabled, disabledReason, tip })
  return (
    <SplitButton
      tone={variant === 'outline' ? 'outline' : 'primary'}
      disabled={state.disabled}
      className={cn('tb-split', className)}
      main={{
        label: label ?? (state.anyUsable ? `${verb} ${state.name}` : `${verb} agent`),
        tooltip: state.mainTip,
        onClick: () => (state.mainOpensMenu ? setMenuOpen(true) : onRun(selected)),
      }}
      menu={{
        label: 'Choose which agent',
        tooltip: 'Choose which agent',
        open: menuOpen,
        onOpenChange: setMenuOpen,
        align: 'end',
        content: runtimes.map((runtime) => (
          <DropdownMenuItem
            key={runtime.id}
            disabled={!runtime.usable}
            onSelect={() => onRun(runtime.id)}
            aria-checked={runtime.id === selected}
            role="menuitemradio"
          >
            {runtime.id === selected ? <Icon name="check" size={14} tone="inherit" /> : <span className="w-[14px]" />}
            <span>
              {FULL_NAMES[runtime.id]}
              {runtime.usable ? '' : ` · ${unavailableWords(runtime)}`}
            </span>
          </DropdownMenuItem>
        )),
      }}
    />
  )
}
