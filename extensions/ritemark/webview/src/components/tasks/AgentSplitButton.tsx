/**
 * AgentSplitButton — every board action that starts agent work (Give to,
 * Review with, Retry with, Send to): the label names the agent, the caret
 * picks Claude Code, Codex or OpenCode, and a choice becomes the board's
 * default (Jarmo, 2026-10-12; design.md D10).
 */

import type { AgentId } from '../../../../src/agent/types'
import type { BoardRuntimeView } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'

const FULL_NAMES: Record<AgentId, string> = { 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode' }

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

export function AgentSplitButton({
  verb,
  label,
  runtimes,
  selected,
  onRun,
  tip,
  variant = 'default',
  disabled = false,
  inDialog = false,
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
  /** Menus opened inside the card dialog take the z-90 popover layer. */
  inDialog?: boolean
  className?: string
}) {
  const current = runtimes.find((runtime) => runtime.id === selected)
  const name = current?.label ?? 'agent'
  const anyUsable = runtimes.some((runtime) => runtime.usable)
  const usable = Boolean(current?.usable)
  const mainTip = !anyUsable
    ? 'Set up Claude, Codex or OpenCode in the AI sidebar first'
    : usable
      ? tip(name)
      : (current?.message ?? `${name} is not ready.`)
  return (
    <span className={cn('tb-split', variant === 'outline' && 'tb-split-outline', className)}>
      <Tooltip label={mainTip}>
        <Button type="button" size="sm" variant={variant} disabled={disabled || !usable} onClick={() => onRun(selected)}>
          <span className="truncate">{label ?? (anyUsable ? `${verb} ${name}` : `${verb} agent`)}</span>
        </Button>
      </Tooltip>
      <DropdownMenu modal={false}>
        <Tooltip label="Choose which agent">
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant={variant} disabled={disabled || !anyUsable} aria-label="Choose which agent">
              <Icon name="caret-down" size={12} tone="inherit" />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" className={cn(inDialog && 'z-[90]')}>
          {runtimes.map((runtime) => (
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
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
