/**
 * Settings ▸ Advanced (Sprint 147, R8; experience 15, frame 3): "Nothing in this section is needed to write with
 * Ritemark." Today's Agent Runtime, Agent Timeout, Debug Trace Logging, ChatGPT's approval and sandbox, OpenCode's
 * auto-approve, Component readiness and Transcription data, in plain words (I3–I6, I28, I29, I31, I41, I42, I56–I58,
 * I60). The same `setSetting` keys and the same actions; a stored value a control doesn't offer shows as it is and is
 * never rewritten.
 *
 * Ritemark's parts: Check asks Claude and ChatGPT again; Repair… opens today's three readiness cards, moved whole into
 * a sheet (the Experience lead's answer 5 draws its rows). A state that needs the person reads in words, with no dot.
 */

import { useState, type ReactNode } from 'react'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Icon } from '../ui/Icon'
import { SegmentedControl } from '../ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import { AdvancedSettingsLink } from './AdvancedSettingsLink'
import { SettingsGroup, SettingsRow, TipButton } from './SettingsRow'
import { formatSize } from './UpdatesSection'
import { CHECKING, type SettingsPending } from './settingsParts'

export interface RuntimeStatusModel {
  runtime: 'missing' | 'installed' | 'architecture_mismatch' | 'launch_failed'
  source: 'bundled' | 'system' | 'unknown'
  auth: 'ready' | 'sign_in_required' | 'unknown' | 'error'
}

export interface ComponentStatus {
  voiceModel: { installed: boolean; modelName: string; filename: string; managedBy: 'ritemark'; sizeBytes: number; sizeDisplay: string }
  claudeCode: {
    installed: boolean
    runnable: boolean
    authenticated: boolean
    version: string | null
    sdkVersion: string | null
    binaryPath: string | null
    authMethod: 'claude-oauth' | 'api-key' | null
    managedBy: 'user'
    state: 'ready' | 'needs-auth' | 'auth-in-progress' | 'not-installed' | 'broken'
    error: string | null
    diagnostics: string[]
    repairAction: 'install' | 'repair' | 'reload' | null
    runtimeStatus: RuntimeStatusModel
  }
  codex: {
    installed: boolean
    version: string | null
    managedBy: 'user'
    state: 'ready' | 'broken' | 'not-installed'
    error: string | null
    diagnostics: string[]
    repairCommand: string | null
    compatibility: unknown
    runtimeStatus: RuntimeStatusModel
  }
}

export interface AgentEnvironment {
  gitInstalled: boolean
  nodeInstalled: boolean
  gitRequired: boolean
  nodeRequired: boolean
  restartRequired: boolean
}

export interface AdvancedSettings {
  agentRuntimePreference: 'bundled' | 'system'
  environment?: AgentEnvironment | null
  agentTimeout: number
  debugTrace: boolean
  codexIntegration: boolean
  codexApprovalPolicy: 'untrusted' | 'on-request' | 'on-failure' | 'never'
  codexSandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access'
  opencodeEnabled: boolean
  opencodeAutoApprove: boolean
  transcriptionEnabled: boolean
  transcriptionStorageBytes: number
  componentStatus: ComponentStatus
  /** PR 3 (R10): the parts still coming. */
  pending?: SettingsPending
}

type ClaudeAction = 'claude:install' | 'claude:repair' | 'claude:login' | 'claude:reload' | 'claude:refreshStatus'
type CodexAction = 'codex:startLogin' | 'codex:refreshStatus' | 'codex:repair'

/** When the AI goes quiet: the steps, in minutes (the plan's decision), and the stored value when it isn't one. */
export const QUIET_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const
export function quietChoices(stored: number): number[] {
  return QUIET_MINUTES.includes(stored as (typeof QUIET_MINUTES)[number]) ? [...QUIET_MINUTES] : [...QUIET_MINUTES, stored].sort((a, b) => a - b)
}

export const APPROVAL_CHOICES = [
  { value: 'untrusted', label: 'Every command and change' },
  { value: 'on-request', label: 'Only outside this project' },
  { value: 'on-failure', label: 'Only when something fails' },
  { value: 'never', label: 'Never' },
] as const
export const SANDBOX_CHOICES = [
  { value: 'read-only', label: 'Nowhere: it only reads' },
  { value: 'workspace-write', label: 'In this project only' },
  { value: 'danger-full-access', label: 'Everywhere, with the network' },
] as const

function sourceName(source: RuntimeStatusModel['source']): string {
  return source === 'bundled' ? "Ritemark's own" : source === 'system' ? "this computer's" : 'none found'
}

/** Where the AI runs from: what runs now, this computer's tools, and the fallback (I4, I5, I6). */
export function runtimeLine(settings: AdvancedSettings): string {
  if (settings.pending?.claudeCode || settings.pending?.codex) return `Now: ${CHECKING}`
  const claude = settings.componentStatus.claudeCode.runtimeStatus.source
  const chatgpt = settings.componentStatus.codex.runtimeStatus.source
  const parts = [claude === chatgpt
    ? `Now: Claude and ChatGPT from ${sourceName(claude)}.`
    : `Now: Claude from ${sourceName(claude)}, ChatGPT from ${sourceName(chatgpt)}.`]
  if (settings.agentRuntimePreference === 'system' && (claude === 'bundled' || chatgpt === 'bundled')) {
    parts.push("This computer's install wasn't found, so Ritemark's own runs instead.")
  }
  const env = settings.environment
  if (settings.pending?.environment) {
    parts.push(`This computer's tools: ${CHECKING}`)
  } else if (env) {
    const tools: { name: string; installed: boolean; required: boolean; note: string }[] = [
      { name: 'Git', installed: env.gitInstalled, required: env.gitRequired, note: ' File changes needs it.' },
      ...(settings.agentRuntimePreference === 'system' ? [{ name: 'Node.js', installed: env.nodeInstalled, required: env.nodeRequired, note: '' }] : []),
    ]
    for (const tool of tools) {
      parts.push(tool.installed
        ? `This computer has ${tool.name}.`
        : tool.required
          ? `${tool.name} isn’t installed, and Claude from this computer needs it. Use Ritemark’s own Claude instead, or install ${tool.name} and restart Ritemark.`
          : `${tool.name} isn’t installed on this computer.${tool.note}`)
    }
    if (env.restartRequired) parts.push('Restart Ritemark to finish setting up Claude.')
  }
  return parts.join(' ')
}

/** Ritemark's parts' line: all ready, or what needs a hand, a sign-in included. */
export function partsLine(status: ComponentStatus, pending?: SettingsPending): string {
  if (pending?.claudeCode || pending?.codex) return CHECKING
  const needs: string[] = []
  if (!status.voiceModel.installed) needs.push("the voice model isn't on this computer")
  const claude = status.claudeCode
  if (claude.state === 'not-installed') needs.push("Claude isn't installed")
  else if (claude.state === 'broken') needs.push(claude.repairAction === 'reload' ? 'Claude waits for a reload' : 'Claude needs a repair')
  // Sign-in, as the Repair sheet's cards name it (Codex on #644): words, never an amber dot
  else if (claude.state === 'needs-auth' || claude.runtimeStatus.auth === 'sign_in_required') needs.push('Claude needs you to sign in')
  else if (claude.state === 'auth-in-progress') needs.push('Claude is signing in')
  else if (claude.runtimeStatus.auth === 'error') needs.push("Claude's account couldn't be checked")
  const codex = status.codex
  if (codex.state === 'not-installed') needs.push("ChatGPT isn't installed")
  else if (codex.state === 'broken') needs.push('ChatGPT needs a repair')
  else if (codex.runtimeStatus.auth === 'sign_in_required') needs.push('ChatGPT needs you to sign in')
  else if (codex.runtimeStatus.auth === 'error') needs.push("ChatGPT's account couldn't be checked")
  if (needs.length === 0) return 'The voice model, Claude and ChatGPT: all ready'
  const text = needs.join('; ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function AdvancedSection({
  settings,
  onSetting,
  onClaude,
  onCodex,
  onClearTranscripts,
  onOpenAllSettings,
}: {
  settings: AdvancedSettings
  onSetting: (key: string, value: string | number | boolean) => void
  onClaude: (action: ClaudeAction) => void
  onCodex: (action: CodexAction) => void
  onClearTranscripts: () => void
  onOpenAllSettings: (type: string) => void
}) {
  const [partsOpen, setPartsOpen] = useState(false)
  const status = settings.componentStatus
  const timeout = settings.agentTimeout || 15
  const showAlone = settings.codexIntegration || settings.opencodeEnabled

  return (
    <>
      <SettingsRow row="I3 I4 I5 I6" name="Where the AI runs from" line={runtimeLine(settings)}>
        <SegmentedControl
          aria-label="Where the AI runs from"
          value={settings.agentRuntimePreference ?? 'bundled'}
          onValueChange={(value) => onSetting('agentRuntime.preference', value)}
          options={[{ value: 'bundled', label: "Ritemark's own" }, { value: 'system', label: "This computer's" }]}
        />
      </SettingsRow>
      <SettingsRow row="I41" name="When the AI goes quiet" line="Ritemark stops Claude when it shows nothing for this long">
        <Select value={String(timeout)} onValueChange={(value) => onSetting('ai.agentTimeout', Number(value))}>
          <SelectTrigger aria-label="When the AI goes quiet" className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {quietChoices(timeout).map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      {showAlone && <SettingsGroup>What the AIs may do alone</SettingsGroup>}
      {settings.codexIntegration && (
        <>
          <SettingsRow row="I28" name="ChatGPT asks before" line="Running a command or changing a file">
            <Select value={settings.codexApprovalPolicy || 'untrusted'} onValueChange={(value) => onSetting('codex.approvalPolicy', value)}>
              <SelectTrigger aria-label="ChatGPT asks before" className="w-[220px] max-[560px]:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_CHOICES.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow row="I29" name="Where ChatGPT may write" line="Reading is allowed everywhere it is let in">
            <Select value={settings.codexSandboxMode || 'workspace-write'} onValueChange={(value) => onSetting('codex.sandboxMode', value)}>
              <SelectTrigger aria-label="Where ChatGPT may write" className="w-[220px] max-[560px]:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SANDBOX_CHOICES.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </SettingsRow>
        </>
      )}
      {settings.opencodeEnabled && (
        <SettingsRow row="I31" name="OpenCode changes files without asking" line="Inside this project only. Writes outside it are always blocked.">
          <Switch
            aria-label="OpenCode changes files without asking"
            checked={settings.opencodeAutoApprove ?? false}
            onCheckedChange={(value) => onSetting('opencode.autoApprove', value)}
          />
        </SettingsRow>
      )}

      <SettingsGroup>When something isn&apos;t right</SettingsGroup>
      <SettingsRow row="I56 I57 I17" name="Ritemark's parts" line={partsLine(status, settings.pending)}>
        <TipButton
          tip="Checks Claude and ChatGPT again"
          variant="ghost"
          size="sm"
          onClick={() => {
            onClaude('claude:refreshStatus')
            onCodex('codex:refreshStatus')
          }}
        >
          Check
        </TipButton>
        <TipButton tip="The voice model, Claude and ChatGPT, with their versions and repairs" variant="ghost" size="sm" onClick={() => setPartsOpen(true)}>
          Repair…
        </TipButton>
      </SettingsRow>
      <SettingsRow row="I42" name="Keep a detailed log" line="For reporting a problem. Off unless someone asks you for it. Reload the window after changing it.">
        <Switch aria-label="Keep a detailed log" checked={settings.debugTrace ?? false} onCheckedChange={(value) => onSetting('ai.debugTrace', value)} />
      </SettingsRow>
      {settings.transcriptionEnabled && (
        <SettingsRow
          row="I58"
          id="settings-section-transcription"
          name="Transcripts' working files"
          line={settings.pending?.transcriptionStorageBytes ? CHECKING : `${settings.transcriptionStorageBytes > 0 ? `${formatSize(settings.transcriptionStorageBytes)} of transcripts, speaker names and corrections.` : 'None yet.'} Your recordings and saved documents are kept apart.`}
        >
          <TipButton
            tip={settings.transcriptionStorageBytes ? 'Removes them; your recordings and documents stay' : 'Nothing to clear yet'}
            variant="ghost"
            size="sm"
            disabled={!settings.transcriptionStorageBytes || Boolean(settings.pending?.transcriptionStorageBytes)}
            onClick={onClearTranscripts}
          >
            Clear
          </TipButton>
        </SettingsRow>
      )}

      <AdvancedSettingsLink post={onOpenAllSettings} />

      <Dialog open={partsOpen} onOpenChange={setPartsOpen}>
        <DialogContent className="max-w-[640px]" aria-describedby={undefined}>
          <DialogHeader onClose={() => setPartsOpen(false)}>
            <DialogTitle>Ritemark&apos;s parts</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-4 text-[13px] leading-[18px] text-ink-muted">
              Ritemark keeps these on this computer. Repair one only if something isn&apos;t working.
            </p>
            <ReadinessCards status={status} onClaude={onClaude} onCodex={onCodex} />
          </DialogBody>
          <DialogFooter>
            <TipButton tip="Closes this sheet" size="sm" onClick={() => setPartsOpen(false)}>Done</TipButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Today's Component readiness (I56, I57), moved whole: the voice model, Claude and ChatGPT, with their actions. */
function ReadinessCards({ status, onClaude, onCodex }: { status: ComponentStatus; onClaude: (a: ClaudeAction) => void; onCodex: (a: CodexAction) => void }) {
  const claude = status.claudeCode
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <ComponentCard
        icon={<Icon name="hard-drive" size={16} />}
        title="Voice model"
        status={status.voiceModel.installed ? 'Installed' : 'Missing'}
        details={[
          `${status.voiceModel.modelName} (${status.voiceModel.filename})`,
          status.voiceModel.installed ? `On disk: ${status.voiceModel.sizeDisplay}` : `Download size: ${status.voiceModel.sizeDisplay}`,
          'Managed by Ritemark',
        ]}
      />
      <RuntimeStatusCard
        icon={<Icon name="shield-check" size={16} />}
        title="Claude"
        runtimeStatus={claude.runtimeStatus}
        version={claude.version}
        sdkVersion={claude.sdkVersion}
        errorMessage={claude.error}
        diagnostics={claude.diagnostics}
      >
        {claude.repairAction === 'reload' ? (
          <TipButton tip="Reloads this window to finish the repair" size="sm" onClick={() => onClaude('claude:reload')}>Reload window</TipButton>
        ) : claude.runtimeStatus.runtime === 'missing' ? (
          <TipButton tip="Installs Claude for Ritemark" size="sm" onClick={() => onClaude('claude:install')}>Install Claude</TipButton>
        ) : claude.runtimeStatus.auth === 'sign_in_required' ? (
          <TipButton tip="Opens Claude's sign-in in your browser" size="sm" onClick={() => onClaude('claude:login')}>Sign in with Claude.ai</TipButton>
        ) : claude.state === 'auth-in-progress' ? (
          <TipButton tip="Asks Claude for its state again" variant="ghost" size="sm" onClick={() => onClaude('claude:refreshStatus')}>Refresh status</TipButton>
        ) : (
          <TipButton tip="Checks Claude's installation again" variant="ghost" size="sm" onClick={() => onClaude('claude:refreshStatus')}>Check installation</TipButton>
        )}
        <TipButton tip="Repairs Claude's runtime" variant="ghost" size="sm" onClick={() => onClaude('claude:repair')}>Repair runtime</TipButton>
      </RuntimeStatusCard>
      <RuntimeStatusCard
        icon={<Icon name="robot" size={16} />}
        title="ChatGPT"
        runtimeStatus={status.codex.runtimeStatus}
        version={status.codex.version}
        errorMessage={status.codex.error}
        diagnostics={status.codex.diagnostics}
      >
        {status.codex.runtimeStatus.auth === 'sign_in_required' ? (
          <TipButton tip="Opens ChatGPT's sign-in in your browser" size="sm" onClick={() => onCodex('codex:startLogin')}>Sign in with ChatGPT</TipButton>
        ) : (
          <TipButton tip="Checks ChatGPT's installation again" variant="ghost" size="sm" onClick={() => onCodex('codex:refreshStatus')}>Check installation</TipButton>
        )}
        <TipButton tip="Repairs ChatGPT's runtime" variant="ghost" size="sm" onClick={() => onCodex('codex:repair')}>Repair runtime</TipButton>
      </RuntimeStatusCard>
    </div>
  )
}

function ComponentCard({ icon, title, status, details }: { icon: ReactNode; title: string; status: string; details: string[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-strong">{icon}{title}</div>
      <div className="mt-2 text-sm text-ink-strong">{status}</div>
      <div className="mt-2 space-y-1 text-xs text-ink-muted">
        {details.map((detail) => <div key={detail} className="break-words [overflow-wrap:anywhere]">{detail}</div>)}
      </div>
    </div>
  )
}

function getRuntimeStatusCopy(model: RuntimeStatusModel): { label: string; sub: string | null } {
  if (model.runtime === 'missing') return { label: 'Runtime missing', sub: 'The agent runtime was not found' }
  if (model.runtime === 'architecture_mismatch') return { label: 'Architecture mismatch', sub: 'The installed runtime does not match this Mac' }
  if (model.runtime === 'launch_failed') return { label: 'Launch failed', sub: 'The runtime could not start — see diagnostics' }
  switch (model.auth) {
    case 'ready': return { label: 'Ready', sub: null }
    case 'sign_in_required': return { label: 'Sign in required', sub: 'Runtime is installed — connect your account to continue' }
    case 'unknown': return { label: 'Status unknown', sub: 'Could not verify account connection' }
    case 'error': return { label: 'Account error', sub: 'There was a problem verifying your account' }
  }
}

/**
 * The card's dot: green when ready, the error token when the runtime can't run. A state that needs the person (Sign in
 * required, an account to check) reads in words with no dot: the framework has no amber (the Experience lead, PR 2).
 */
export function getRuntimeDotClass(model: RuntimeStatusModel): { bg: string; ariaLabel: string } | null {
  // Sprint 145 (#578): the one green is the ready dot, in the success token, so it is one colour everywhere
  if (model.runtime === 'installed' && model.auth === 'ready') return { bg: 'bg-ritemark-success', ariaLabel: 'Status: ready' }
  if (model.runtime === 'installed') return null
  return { bg: 'bg-ritemark-error', ariaLabel: 'Status: error' }
}

function getSourceChipLabel(source: RuntimeStatusModel['source']): string | null {
  if (source === 'bundled') return 'Bundled with app'
  if (source === 'system') return 'System installation'
  return null
}

function RuntimeStatusCard({
  icon,
  title,
  runtimeStatus,
  version,
  sdkVersion,
  errorMessage,
  diagnostics,
  children,
}: {
  icon: ReactNode
  title: string
  runtimeStatus: RuntimeStatusModel
  version: string | null
  sdkVersion?: string | null
  errorMessage: string | null
  diagnostics: string[]
  children?: ReactNode
}) {
  const copy = getRuntimeStatusCopy(runtimeStatus)
  const dot = getRuntimeDotClass(runtimeStatus)
  const sourceLabel = getSourceChipLabel(runtimeStatus.source)
  const cliLabel = version ? `v${version.replace(/^v/, '')}` : null
  const sdkLabel = sdkVersion ? `SDK ${sdkVersion.replace(/^v/, '')}` : null
  const versionLabel = cliLabel && sdkLabel ? `${cliLabel} · ${sdkLabel}` : cliLabel ?? sdkLabel
  // Auto-expand diagnostics when launch failed — user needs the detail immediately.
  const autoOpenDiagnostics = runtimeStatus.runtime === 'launch_failed'
  const showError = errorMessage && runtimeStatus.runtime !== 'installed'

  return (
    <div className="min-w-0 rounded-lg border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-hairline pb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-strong">{icon}{title}</div>
        {dot ? <span className={`inline-block h-2 w-2 rounded-full ${dot.bg}`} aria-label={dot.ariaLabel} role="status" /> : null}
      </div>
      <div className="mt-3">
        <div className="text-[13px] font-medium leading-snug text-ink-strong">{copy.label}</div>
        {copy.sub && <div className="mt-0.5 text-xs leading-normal text-ink-muted">{copy.sub}</div>}
        {showError && <div className="mt-1 break-words text-xs text-ritemark-error [overflow-wrap:anywhere]">{errorMessage}</div>}
      </div>
      {(sourceLabel || versionLabel) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sourceLabel && <span className="rounded-[3px] bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-ink-body">{sourceLabel}</span>}
          {versionLabel && <span className="rounded-[3px] bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-ink-body">{versionLabel}</span>}
        </div>
      )}
      {children && <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">{children}</div>}
      {diagnostics.length > 0 && (
        <details className="mt-3" open={autoOpenDiagnostics}>
          <summary className="cursor-pointer text-xs text-accent-deep hover:underline">Diagnostics</summary>
          <div className="mt-2 space-y-1 text-xs text-ink-muted">
            {diagnostics.map((detail) => <div key={detail} className="break-words [overflow-wrap:anywhere]">{detail}</div>)}
          </div>
        </details>
      )}
    </div>
  )
}
