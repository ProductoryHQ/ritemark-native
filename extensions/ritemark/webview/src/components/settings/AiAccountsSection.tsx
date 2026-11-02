/**
 * Settings ▸ AI accounts (Sprint 147, R3, W4; experience 15, frame 2 and the Experience lead's answers 6 and 9).
 * Claude, ChatGPT and OpenCode by name, each with one line and one next step; API keys under Other ways to connect,
 * with Open…; AI information at the foot. Each row sends today's messages (`claude:*`, `codex:*`); the Details sheets
 * (`AiDetailsSheet.tsx`) and the API keys sheet (`ApiKeysSheet.tsx`) carry the fuller actions.
 *
 * No amber or red on a row: a part that isn't working isn't the person's error, so its words say what to do (answer 9).
 */

import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { AI_INFORMATION_URL } from '../ai-sidebar/aiDisclosure'
import { PLAN_LINES } from '../welcome/welcomeCopy'
import { ExternalLink, SettingsGroup, SettingsNote, SettingsRow, TipButton } from './SettingsRow'
import type { CodexAuthStatus, SettingsData, TestResult } from './RitemarkSettings'

export type ClaudeAction =
  | 'claude:install' | 'claude:repair' | 'claude:login' | 'claude:logout' | 'claude:reload' | 'claude:refreshStatus'
  | 'claude:cancelLogin' | 'claude:enterApiKey'
export type CodexAction = 'codex:startLogin' | 'codex:logout' | 'codex:refreshStatus' | 'codex:cancelLogin' | 'codex:repair'
export type AiId = 'claude' | 'chatgpt' | 'opencode'

/** One row's state: its line, and its one button (none on Ready rows, which carry the Ready mark). */
export interface AiRowState {
  line: string
  ready: boolean
  /** A second line under the first, for a sign-in's error (I23). */
  note?: string
}

type Claude = SettingsData['componentStatus']['claudeCode']

/** Claude's row (I7–I10, I13), in the lead's words (answer 9). */
export function claudeRow(claude: Claude): AiRowState {
  if (claude.state === 'not-installed') return { line: 'Not on this computer yet.', ready: false }
  if (claude.state === 'broken') {
    return claude.repairAction === 'reload'
      ? { line: 'Repaired. Ritemark reloads its window to finish.', ready: false }
      : { line: "Claude isn't working. Repair it to use it again.", ready: false }
  }
  if (claude.state === 'auth-in-progress') return { line: 'Your browser opened Claude’s sign-in page.', ready: false }
  if (claude.authMethod === 'api-key') return { line: 'Uses your Anthropic API key', ready: true }
  if (claude.state === 'needs-auth') return { line: PLAN_LINES.claude, ready: false }
  return { line: 'Signed in with your Claude account', ready: true }
}

/** ChatGPT's row (I20–I24): never Codex in a visible word. */
export function chatgptRow(auth: CodexAuthStatus, signingIn: boolean): AiRowState {
  if (auth.binaryMissing) return { line: 'Not on this computer yet.', ready: false }
  if (auth.binaryBroken) return { line: "ChatGPT isn't working. Repair it to use it again.", ready: false }
  if (auth.authenticated) return { line: auth.email ? `Signed in as ${auth.email}` : 'Signed in with your ChatGPT account', ready: true }
  if (signingIn) return { line: 'Your browser opened ChatGPT’s sign-in page.', ready: false }
  return { line: `Not signed in. ${PLAN_LINES.chatgpt}`, ready: false, note: auth.error }
}

/** The keys OpenCode works with, in the order it prefers them (answer 6: OpenRouter gives it the most models). */
export const OPENCODE_KEYS = [
  { short: 'openrouter', label: 'OpenRouter', configured: 'openrouterKeyConfigured' },
  { short: 'openai', label: 'OpenAI', configured: 'openaiKeyConfigured' },
  { short: 'anthropic', label: 'Anthropic', configured: 'anthropicKeyConfigured' },
  { short: 'google', label: 'Google AI', configured: 'googleKeyConfigured' },
] as const

/**
 * OpenCode's row (I30; answer 6): Ready once a key it uses is saved and that key's last test didn't fail, and its line
 * names the key. A key that failed its test doesn't count.
 */
export function opencodeRow(settings: SettingsData, results: Record<string, TestResult>): AiRowState & { key?: string } {
  const saved = OPENCODE_KEYS.filter((key) => settings[key.configured] && (key.short !== 'openrouter' || settings.openrouterEnabled))
  const working = saved.find((key) => results[key.short]?.success !== false)
  if (working) return { line: `Open models, with your ${working.label} key`, ready: true, key: working.label }
  if (saved.length) return { line: `Your ${saved[0].label} key didn't work. Add another or change it.`, ready: false }
  return { line: PLAN_LINES.opencode, ready: false }
}

/** How many of the five keys are saved, for the API keys row's line. */
export function savedKeyCount(settings: SettingsData): number {
  return [
    settings.openaiKeyConfigured,
    settings.anthropicKeyConfigured,
    settings.googleKeyConfigured,
    settings.openrouterEnabled && settings.openrouterKeyConfigured,
    settings.transcriptionEnabled && settings.elevenlabsKeyConfigured,
  ].filter(Boolean).length
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-muted text-[13px] font-semibold text-ink-strong">
      {children}
    </div>
  )
}

function ReadyMark() {
  return (
    <span className="flex items-center gap-1.5 px-1 text-[12px] font-medium text-ink-strong">
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-ritemark-success" />
      Ready
    </span>
  )
}

function DetailsButton({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <TipButton tip={`How ${name} is connected, its version and what it is used for`} variant="ghost" size="sm" onClick={onOpen}>
      Details…
    </TipButton>
  )
}

export function AiAccountsSection({
  settings,
  codexAuth,
  codexSigningIn,
  testResults,
  onClaude,
  onCodex,
  onDetails,
  onKeys,
}: {
  settings: SettingsData
  codexAuth: CodexAuthStatus
  codexSigningIn: boolean
  testResults: Record<string, TestResult>
  onClaude: (action: ClaudeAction) => void
  onCodex: (action: CodexAction) => void
  onDetails: (ai: AiId) => void
  onKeys: (opts?: { forOpenCode?: boolean }) => void
}) {
  const claude = settings.componentStatus.claudeCode
  const claudeState = claudeRow(claude)
  const chatgptState = chatgptRow(codexAuth, codexSigningIn)
  const opencodeState = opencodeRow(settings, testResults)
  const saved = savedKeyCount(settings)

  return (
    <>
      <SettingsRow row="I7 I8 I9 I10 I13 I14 I16" mark={<Mark>C</Mark>} name="Claude" line={claudeState.line}>
          {claudeState.ready ? <ReadyMark />
            : claude.state === 'not-installed' ? <TipButton tip="Installs Claude for Ritemark" variant="outline" size="sm" onClick={() => onClaude('claude:install')}>Install</TipButton>
            : claude.state === 'broken' && claude.repairAction === 'reload' ? <TipButton tip="Reloads this window to finish the repair; your work stays as it is" variant="outline" size="sm" onClick={() => onClaude('claude:reload')}>Reload window</TipButton>
            : claude.state === 'broken' ? <TipButton tip="Repairs Claude's runtime" variant="outline" size="sm" onClick={() => onClaude('claude:repair')}>Repair</TipButton>
            : claude.state === 'auth-in-progress' ? <TipButton tip="Stops waiting for Claude's sign-in" variant="outline" size="sm" onClick={() => onClaude('claude:cancelLogin')}>Cancel</TipButton>
            : <TipButton tip="Opens Claude's sign-in in your browser" variant="outline" size="sm" onClick={() => onClaude('claude:login')}>Sign in</TipButton>}
          <DetailsButton name="Claude" onOpen={() => onDetails('claude')} />
        </SettingsRow>

      <SettingsRow row="I20 I21 I22 I23 I24" mark={<Mark><Icon name="open-ai-logo" size={16} /></Mark>}
          name="ChatGPT"
          line={chatgptState.note ? <>{chatgptState.line}<span className="block">{chatgptState.note}</span></> : chatgptState.line}
        >
          {chatgptState.ready ? <ReadyMark />
            : codexAuth.binaryMissing ? <TipButton tip="Installs ChatGPT for Ritemark" variant="outline" size="sm" onClick={() => onCodex('codex:repair')}>Install</TipButton>
            : codexAuth.binaryBroken ? <TipButton tip="Repairs ChatGPT's runtime" variant="outline" size="sm" onClick={() => onCodex('codex:repair')}>Repair</TipButton>
            : codexSigningIn ? <TipButton tip="Stops waiting for ChatGPT's sign-in" variant="outline" size="sm" onClick={() => onCodex('codex:cancelLogin')}>Cancel</TipButton>
            : <TipButton tip="Opens ChatGPT's sign-in in your browser" variant="outline" size="sm" onClick={() => onCodex('codex:startLogin')}>Sign in</TipButton>}
          <DetailsButton name="ChatGPT" onOpen={() => onDetails('chatgpt')} />
        </SettingsRow>

      {settings.opencodeEnabled && (
        <SettingsRow row="I30" mark={<Mark><Icon name="cube" size={16} /></Mark>} name="OpenCode" line={opencodeState.line}>
            {opencodeState.ready ? (
              <>
                <ReadyMark />
                <DetailsButton name="OpenCode" onOpen={() => onDetails('opencode')} />
              </>
            ) : (
              <TipButton tip="Opens the API keys: OpenCode works with any one of four" variant="outline" size="sm" onClick={() => onKeys({ forOpenCode: true })}>Set up</TipButton>
            )}
          </SettingsRow>
      )}

      <SettingsGroup>Other ways to connect</SettingsGroup>
      <SettingsRow row={`I32 I33 I34${settings.openrouterEnabled ? ' I35' : ''}${settings.transcriptionEnabled ? ' I36' : ''} I37 I38`} mark={<Mark><Icon name="key" size={16} /></Mark>}
          name="API keys"
          line={`For Anthropic, OpenAI, Google${settings.openrouterEnabled ? ', OpenRouter' : ''}${settings.transcriptionEnabled ? ' and ElevenLabs' : ''}, if you have them. ${saved === 0 ? 'None saved.' : `${saved} saved.`}`}
        >
          <TipButton tip="Adds, tests, changes or removes your API keys" variant="ghost" size="sm" onClick={() => onKeys()}>Open…</TipButton>
        </SettingsRow>

      <SettingsNote icon="shield-check" row="I59">
        What each AI service may see: <ExternalLink url={AI_INFORMATION_URL} tip="Which AI services Ritemark uses, what they may see, and how to review what they write">AI information</ExternalLink>
      </SettingsNote>
    </>
  )
}
