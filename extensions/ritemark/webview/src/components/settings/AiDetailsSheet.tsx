/**
 * An AI's Details sheet (Sprint 147, R3, W4; experience 15, frame 8; the Experience lead's answers 1 and 9): how it is
 * signed in and who is billed, Use an API key instead or Use Claude.ai sign-in, its version with Check again, Used for
 * with Learn more, Technical details folded, and at the foot Sign out, Repair and Done. One sheet for Claude, ChatGPT
 * and OpenCode; every state keeps its fuller actions here (I8–I19, I22–I27). It sends today's messages.
 *
 * `AiDetailsRows` is the sheet's content without its dialog, so render tests can draw it.
 */

import type { ReactNode } from 'react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Icon } from '../ui/Icon'
import { PLAN_LINES } from '../welcome/welcomeCopy'
import { vscode } from '../../lib/vscode'
import { ExternalLink, TipButton } from './SettingsRow'
import { opencodeRow, type AiId, type ClaudeAction, type CodexAction } from './AiAccountsSection'
import type { CodexAuthStatus, SettingsData, TestResult } from './RitemarkSettings'
import { WaitingMark } from '../ui/turning-mark'

export interface AiDetailsProps {
  ai: AiId
  settings: SettingsData
  codexAuth: CodexAuthStatus
  codexSigningIn: boolean
  testResults: Record<string, TestResult>
  onClaude: (action: ClaudeAction) => void
  onCodex: (action: CodexAction) => void
  onKeys: () => void
  /** A sheet-closing action's after-step (Done). */
  onDone: () => void
}

const NAMES: Record<AiId, string> = { claude: 'Claude', chatgpt: 'ChatGPT', opencode: 'OpenCode' }

function DetailRow({ label, children, action, row }: { label: string; children: ReactNode; action?: ReactNode; row?: string }) {
  return (
    <div data-settings-row={row} className="flex items-center gap-4 border-t border-hairline py-3 first:border-t-0">
      <div className="w-[84px] shrink-0 text-[12px] leading-4 text-ink-muted">{label}</div>
      {/* When the words and the actions don't fit side by side, the actions go on their own line under the words (the Experience lead, #645) */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="grid min-w-0 flex-[1_1_180px] text-[13px] leading-[18px] text-ink-strong">{children}</div>
        {action ? <div data-detail-actions className="flex min-w-0 max-w-full flex-wrap items-center gap-1">{action}</div> : null}
      </div>
    </div>
  )
}

const Sub = ({ children }: { children: ReactNode }) => <span className="text-[12px] leading-4 text-ink-muted [overflow-wrap:anywhere]">{children}</span>

function Technical({ lines, children }: { lines: string[]; children?: ReactNode }) {
  if (!lines.length && !children) return null
  return (
    <details data-settings-row="I18" className="group border-t border-hairline py-3">
      <summary className="rm-focus-ring flex list-none items-center gap-1.5 rounded text-[13px] text-ink-strong [&::-webkit-details-marker]:hidden">
        <Icon name="caret-right" size={12} className="transition-transform group-open:rotate-90" />
        <span className="font-medium">Technical details</span>
        <span className="text-[12px] text-ink-muted">where it runs from, and what Ritemark found</span>
      </summary>
      <div className="mt-2 grid gap-1 pl-[18px] text-[12px] leading-4 text-ink-muted">
        {lines.map((line, i) => <div key={`${i}-${line}`} className="break-words [overflow-wrap:anywhere]">{line}</div>)}
        {children}
      </div>
    </details>
  )
}

function sourceWords(source: 'bundled' | 'system' | 'unknown'): string {
  return source === 'system' ? "This computer's" : source === 'bundled' ? "Ritemark's own" : 'Where it runs from is not known yet'
}

function ClaudeDetails({ settings, onClaude }: Pick<AiDetailsProps, 'settings' | 'onClaude'>) {
  const claude = settings.componentStatus.claudeCode
  const apiKey = claude.authMethod === 'api-key'
  const ready = claude.state === 'ready' || apiKey
  const signedIn = claude.state === 'not-installed' ? (
    <DetailRow row="I8" label="Signed in" action={<TipButton tip="Installs Claude for Ritemark" size="sm" onClick={() => onClaude('claude:install')}>Install Claude</TipButton>}>
      Not on this computer yet.
    </DetailRow>
  ) : claude.state === 'broken' ? (
    <DetailRow row="I9" label="Signed in" action={claude.repairAction === 'reload'
      ? <TipButton tip="Reloads this window to finish the repair; your work stays as it is" size="sm" onClick={() => onClaude('claude:reload')}>Reload window</TipButton>
      : <TipButton tip="Repairs Claude's runtime" size="sm" onClick={() => onClaude('claude:repair')}>Repair Claude</TipButton>}>
      {claude.repairAction === 'reload' ? 'Repaired. Ritemark reloads its window to finish.' : "Claude isn't working. Repair it to use it again."}
      {claude.error ? <Sub>{claude.error}</Sub> : null}
    </DetailRow>
  ) : claude.state === 'auth-in-progress' ? (
    <DetailRow row="I13" label="Signed in" action={<TipButton tip="Stops waiting for Claude's sign-in" variant="outline" size="sm" onClick={() => onClaude('claude:cancelLogin')}>Cancel sign-in</TipButton>}>
      Signing in
      <Sub>Your browser opened Claude’s sign-in page. Ritemark updates when you finish.</Sub>
    </DetailRow>
  ) : apiKey ? (
    <DetailRow row="I14 I16" label="Signed in" action={<TipButton tip="Opens Claude's sign-in in your browser" variant="ghost" size="sm" onClick={() => onClaude('claude:login')}>Use Claude.ai sign-in</TipButton>}>
      With an Anthropic API key
      <Sub>Billed to the key’s Anthropic account</Sub>
    </DetailRow>
  ) : ready ? (
    <DetailRow row="I14 I11" label="Signed in" action={<TipButton tip="Asks for your Anthropic API key" variant="ghost" size="sm" onClick={() => onClaude('claude:enterApiKey')}>Use an API key instead</TipButton>}>
      With Claude.ai
      <Sub>Billed to your Claude plan</Sub>
    </DetailRow>
  ) : (
    <DetailRow row="I10 I11 I12" label="Signed in" action={
      <>
        <TipButton tip="Opens Claude's sign-in in your browser" size="sm" onClick={() => onClaude('claude:login')}>Sign in with Claude.ai</TipButton>
        <TipButton tip="Asks for your Anthropic API key" variant="ghost" size="sm" onClick={() => onClaude('claude:enterApiKey')}>Use an API key instead</TipButton>
      </>
    }>
      Not signed in
      <Sub>{PLAN_LINES.claude} No key yet? <ExternalLink url="https://console.anthropic.com/" tip="Opens Anthropic's console, where you can make an API key" className="text-[12px]">Get one at Anthropic</ExternalLink></Sub>
    </DetailRow>
  )

  return (
    <>
      {signedIn}
      <DetailRow row="I14 I17" label="Version" action={<TipButton tip="Asks Claude for its state again" variant="ghost" size="sm" onClick={() => onClaude('claude:refreshStatus')}>Check again</TipButton>}>
        {claude.version ? `Claude ${claude.version}` : 'Claude'}
        <Sub>{sourceWords(claude.runtimeStatus.source)}{ready ? ', ready' : ''}</Sub>
      </DetailRow>
      <DetailRow row="I19" label="Used for" action={<ExternalLink url="https://docs.anthropic.com/en/docs/claude-code/setup" tip="Opens Anthropic's page about Claude in your browser">Learn more</ExternalLink>}>
        Chats, tasks and flows
      </DetailRow>
      <Technical lines={[
        ...(claude.binaryPath ? [`Runs from ${claude.binaryPath}`] : []),
        ...(claude.sdkVersion ? [`SDK ${claude.sdkVersion}`] : []),
        ...claude.diagnostics,
      ]} />
    </>
  )
}

function ChatgptDetails({ settings, codexAuth, codexSigningIn, onCodex }: Pick<AiDetailsProps, 'settings' | 'codexAuth' | 'codexSigningIn' | 'onCodex'>) {
  const codex = settings.componentStatus.codex
  const plan = codexAuth.plan ? `ChatGPT ${codexAuth.plan.charAt(0).toUpperCase()}${codexAuth.plan.slice(1)}` : null
  const credits = codexAuth.credits
    ? `$${(codexAuth.credits.limit - codexAuth.credits.used).toFixed(2)} of $${codexAuth.credits.limit.toFixed(2)} API credits left`
    : null
  const signedIn = codexAuth.binaryMissing || codexAuth.binaryBroken ? (
    <DetailRow row="I24" label="Signed in" action={<TipButton tip={codexAuth.binaryMissing ? 'Installs ChatGPT for Ritemark' : "Repairs ChatGPT's runtime"} size="sm" onClick={() => onCodex('codex:repair')}>{codexAuth.binaryMissing ? 'Install ChatGPT' : 'Repair ChatGPT'}</TipButton>}>
      {codexAuth.binaryMissing ? 'Not on this computer yet.' : "ChatGPT isn't working. Repair it to use it again."}
      {codexAuth.error ? <Sub>{codexAuth.error}</Sub> : null}
      {codexAuth.repairCommand ? (
        <>
          <Sub>{codexAuth.binaryMissing ? 'This computer’s ChatGPT is missing. Install it first:' : 'This computer’s ChatGPT is broken. Reinstall it first:'}</Sub>
          <code className="mt-1 block break-all rounded bg-surface-soft p-2 font-mono text-[12px] text-ink-strong">{codexAuth.repairCommand}</code>
          <Sub>After reinstalling, reload the window and open Settings again.</Sub>
        </>
      ) : null}
    </DetailRow>
  ) : codexAuth.authenticated ? (
    <DetailRow row="I25" label="Signed in">
      {codexAuth.email ? `As ${codexAuth.email}` : 'With your ChatGPT account'}
      <Sub>{[plan, credits].filter(Boolean).join(' · ') || 'Billed to your ChatGPT plan'}</Sub>
    </DetailRow>
  ) : codexSigningIn ? (
    <DetailRow row="I22" label="Signed in" action={<TipButton tip="Stops waiting for ChatGPT's sign-in" variant="outline" size="sm" onClick={() => onCodex('codex:cancelLogin')}>Cancel sign-in</TipButton>}>
      Signing in
      <Sub>Your browser opened ChatGPT’s sign-in page.</Sub>
    </DetailRow>
  ) : (
    <DetailRow row="I21 I22 I23" label="Signed in" action={<TipButton tip="Opens ChatGPT's sign-in in your browser" size="sm" onClick={() => onCodex('codex:startLogin')}>Sign in with ChatGPT</TipButton>}>
      Not signed in
      <Sub>{PLAN_LINES.chatgpt} No API key is needed. Paid plans get higher limits.</Sub>
      {codexAuth.error ? <Sub>{codexAuth.error}</Sub> : null}
    </DetailRow>
  )

  return (
    <>
      {signedIn}
      <DetailRow label="Version" action={<TipButton tip="Asks ChatGPT for its state again" variant="ghost" size="sm" onClick={() => onCodex('codex:refreshStatus')}>Check again</TipButton>}>
        {codex.version ? `ChatGPT ${codex.version}` : 'ChatGPT'}
        <Sub>{sourceWords(codex.runtimeStatus.source)}{codexAuth.authenticated ? ', ready' : ''}</Sub>
      </DetailRow>
      <DetailRow row="I27" label="Used for" action={<ExternalLink url="https://developers.openai.com/codex/cli" tip="Opens OpenAI's page about ChatGPT's agent in your browser">Learn more</ExternalLink>}>
        Chats, flows and the task board
      </DetailRow>
      <Technical lines={[...(codexAuth.diagnostics ?? codex.diagnostics)]} />
    </>
  )
}

function OpencodeDetails({ settings, testResults, onKeys }: Pick<AiDetailsProps, 'settings' | 'testResults' | 'onKeys'>) {
  const state = opencodeRow(settings, testResults)
  return (
    <>
      <DetailRow row="I30" label="Uses" action={<TipButton tip="Opens the API keys" variant="ghost" size="sm" onClick={onKeys}>Keys…</TipButton>}>
        {state.key ? `Your ${state.key} key` : 'No key yet'}
        <Sub>{PLAN_LINES.opencode}</Sub>
      </DetailRow>
      <DetailRow label="Used for">Chats</DetailRow>
    </>
  )
}

/** The sheet's lede: how it is signed in, and who is billed. */
export function detailsLede(ai: AiId, settings: SettingsData, codexAuth: CodexAuthStatus): string {
  if (ai === 'claude') {
    const claude = settings.componentStatus.claudeCode
    if (claude.authMethod === 'api-key') return 'Uses your Anthropic API key. Anthropic bills that key’s account.'
    if (claude.state === 'ready') return 'Signed in with your Claude account. Claude uses your plan’s limits.'
    return 'Claude works through your Claude plan or an Anthropic API key.'
  }
  if (ai === 'chatgpt') {
    return codexAuth.authenticated
      ? 'Signed in with your ChatGPT account. ChatGPT uses your plan’s limits.'
      : 'ChatGPT works through your ChatGPT account. Any plan works, free included.'
  }
  return 'OpenCode runs open models with an API key of your own.'
}

export function AiDetailsRows(props: AiDetailsProps) {
  // PR 3 (R10): opened before its AI's answer came: one row says so, and the sheet fills in when it comes
  if ((props.ai === 'claude' && props.settings.pending?.claudeCode) || (props.ai === 'chatgpt' && props.settings.pending?.codex && !props.codexSigningIn)) {
    return <DetailRow label="Signed in"><WaitingMark label={`Checking ${NAMES[props.ai]}`} /></DetailRow>
  }
  return props.ai === 'claude' ? <ClaudeDetails {...props} />
    : props.ai === 'chatgpt' ? <ChatgptDetails {...props} />
    : <OpencodeDetails {...props} />
}

/** The foot: Sign out at the left, quiet; Repair and Done at the right (frame 8). */
export function AiDetailsFoot({ ai, settings, codexAuth, onClaude, onCodex, onDone }: AiDetailsProps) {
  const claude = settings.componentStatus.claudeCode
  const signOut = ai === 'claude' && claude.state === 'ready' && claude.authMethod === 'claude-oauth'
    ? <TipButton tip="Signs Claude out of your Claude.ai account here" variant="ghost" size="sm" onClick={() => onClaude('claude:logout')}>Sign out</TipButton>
    : ai === 'chatgpt' && codexAuth.authenticated
      ? <TipButton tip="Signs ChatGPT out here" variant="ghost" size="sm" onClick={() => onCodex('codex:logout')}>Sign out</TipButton>
      : null
  const repair = ai === 'claude'
    ? <TipButton tip="Repairs Claude's runtime" variant="ghost" size="sm" onClick={() => onClaude('claude:repair')}>Repair Claude</TipButton>
    : ai === 'chatgpt'
      ? <TipButton tip="Repairs ChatGPT's runtime" variant="ghost" size="sm" onClick={() => onCodex('codex:repair')}>Repair ChatGPT</TipButton>
      : null
  const reload = ai === 'chatgpt' && (codexAuth.binaryMissing || codexAuth.binaryBroken)
    ? <TipButton tip="Reloads this window; your work stays as it is" variant="ghost" size="sm" onClick={() => vscode.postMessage({ type: 'updates:reload' })}>Reload window</TipButton>
    : null
  return (
    <div data-settings-row="I15 I26" className="flex w-full items-center gap-2">
      <div className="mr-auto">{signOut}</div>
      {reload}
      {repair}
      <TipButton tip="Closes this sheet" size="sm" onClick={onDone}>Done</TipButton>
    </div>
  )
}

export function AiDetailsSheet({ open, ...props }: AiDetailsProps & { open: boolean }) {
  const name = NAMES[props.ai]
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) props.onDone() }}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader onClose={props.onDone}>
          <div className="grid gap-1">
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription className="text-[13px]">{detailsLede(props.ai, props.settings, props.codexAuth)}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody className="py-1">
          <AiDetailsRows {...props} />
        </DialogBody>
        <DialogFooter>
          <AiDetailsFoot {...props} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
