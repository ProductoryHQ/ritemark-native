/**
 * Sprint 147, PR 3 (R10, W5): the page draws first, then fills in. The host's `settings` carries what needs no probe;
 * each slow answer comes as its own `settings:part` (Claude, ChatGPT, the tools line, transcript storage, the first
 * update check). Until a part comes, its rows read Checking… (`pending`), and every other row works.
 *
 * `composeSettings` makes the page's one `SettingsData` from the two, so the sections read it as before.
 */
import type { SettingsData } from './RitemarkSettings'

/** A row whose answer is still coming draws no words: its line is empty for a second, then the kit's mark (`WaitingMark`). */

/** The parts a probe answers; `updateCenter` is in `settings` too (the snapshot), so it is never pending. */
export type SettingsPartName = 'claudeCode' | 'codex' | 'environment' | 'transcriptionStorageBytes' | 'updateCenter'
export const PENDING_PARTS = ['claudeCode', 'codex', 'environment', 'transcriptionStorageBytes'] as const
export type PendingPart = (typeof PENDING_PARTS)[number]
export type SettingsPending = Partial<Record<PendingPart, true>>

type Status = SettingsData['componentStatus']

/** What `settings` carries: everything but the probes' parts, and the voice model (no probe) on its own. */
export type SettingsBase = Omit<SettingsData, 'componentStatus' | 'environment' | 'transcriptionStorageBytes' | 'pending'> & {
  voiceModel: Status['voiceModel']
}

export interface SettingsParts {
  claudeCode?: Status['claudeCode']
  codex?: Status['codex']
  environment?: SettingsData['environment']
  transcriptionStorageBytes?: number
  updateCenter?: SettingsData['updateCenter']
}

const UNKNOWN_RUNTIME = { runtime: 'installed', source: 'unknown', auth: 'unknown' } as const

/** A part still coming: a neutral state the rows never act on (they read `pending` and say Checking…). */
const CLAUDE_CHECKING: Status['claudeCode'] = {
  installed: false, runnable: false, authenticated: false, version: null, sdkVersion: null, binaryPath: null,
  authMethod: null, managedBy: 'user', state: 'needs-auth', error: null, diagnostics: [], repairAction: null,
  runtimeStatus: UNKNOWN_RUNTIME,
}
const CODEX_CHECKING: Status['codex'] = {
  installed: false, version: null, managedBy: 'user', state: 'not-installed', error: null, diagnostics: [],
  repairCommand: null, compatibility: null, runtimeStatus: UNKNOWN_RUNTIME,
}

const PART_NAMES: readonly SettingsPartName[] = ['claudeCode', 'codex', 'environment', 'transcriptionStorageBytes', 'updateCenter']

export function isSettingsPartName(value: unknown): value is SettingsPartName {
  return typeof value === 'string' && (PART_NAMES as readonly string[]).includes(value)
}

/** The page's data from `settings` and the parts in so far; null until `settings` has come. */
export function composeSettings(base: SettingsBase | null, parts: SettingsParts): SettingsData | null {
  if (!base) return null
  const { voiceModel, ...rest } = base
  const pending: SettingsPending = {}
  for (const part of PENDING_PARTS) if (!(part in parts)) pending[part] = true
  return {
    ...rest,
    updateCenter: parts.updateCenter ?? base.updateCenter,
    environment: parts.environment ?? null,
    transcriptionStorageBytes: parts.transcriptionStorageBytes ?? 0,
    componentStatus: {
      voiceModel,
      claudeCode: parts.claudeCode ?? CLAUDE_CHECKING,
      codex: parts.codex ?? CODEX_CHECKING,
    },
    pending,
  }
}

/** One part in: it replaces that part only. */
export function withPart(parts: SettingsParts, part: SettingsPartName, value: unknown): SettingsParts {
  return { ...parts, [part]: value }
}

/** `settings` again: its update snapshot is newer than a first check's answer, so that answer goes. */
export function afterBase(parts: SettingsParts): SettingsParts {
  if (!('updateCenter' in parts)) return parts
  const { updateCenter: _older, ...rest } = parts
  return rest
}

/** A recorded full payload (render tests, `initial`): `settings` and every part in. */
export function splitSettings(settings: SettingsData): { base: SettingsBase; parts: SettingsParts } {
  const { componentStatus, environment, transcriptionStorageBytes, pending: _pending, ...rest } = settings
  return {
    base: { ...rest, voiceModel: componentStatus.voiceModel },
    parts: {
      claudeCode: componentStatus.claudeCode,
      codex: componentStatus.codex,
      environment,
      transcriptionStorageBytes,
    },
  }
}
