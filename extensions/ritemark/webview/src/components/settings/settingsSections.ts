/**
 * Settings' sections as data (Sprint 147, R2, W2; experience 15). The list in the drawing's order; a later sprint adds
 * its section with one entry here (Sprint 151's AI on this computer goes second, decision 1), and nothing is drawn
 * before it ships.
 *
 * The ways in keep their names (I61): other features open Settings at one of five names, which land on the new places
 * here, so no opener changes.
 */

import type { PhosphorIconName as IconName } from '../ui/Icon'

export type SettingsSectionId = 'ai-accounts' | 'appearance' | 'sharing' | 'usage-data' | 'updates' | 'advanced'

export interface SettingsSectionInfo {
  id: SettingsSectionId
  name: string
  icon: IconName
  /** The one line under the section's title (the Experience lead's words). */
  lede: string
}

export const SETTINGS_SECTIONS: readonly SettingsSectionInfo[] = [
  { id: 'ai-accounts', name: 'AI accounts', icon: 'sparkle', lede: 'The AIs you work with, through the accounts you already pay for.' },
  { id: 'appearance', name: 'Appearance', icon: 'palette', lede: 'How Ritemark looks on this computer.' },
  { id: 'sharing', name: 'Sharing', icon: 'share-network', lede: 'Where your copies and pages go when you share them.' },
  { id: 'usage-data', name: 'Usage data', icon: 'chart-bar', lede: 'What Ritemark learns about how it is used, so it can get better.' },
  // The Updates lede carries the version and the last check, so the section draws its own
  { id: 'updates', name: 'Updates', icon: 'arrows-clockwise', lede: '' },
  { id: 'advanced', name: 'Advanced', icon: 'wrench', lede: 'Nothing in this section is needed to write with Ritemark.' },
]

/** Settings opened with no section, or restored after a reload, shows the first (I62, I63). */
export const FIRST_SECTION: SettingsSectionId = 'ai-accounts'

/** Where a way in lands: its section, and the row to bring into view there. */
export interface SettingsLanding {
  section: SettingsSectionId
  /** The element id of the row, or none for the section's top. */
  anchor?: string
  /** A key's way in: the API keys sheet opens at this key's row (Sprint 147, PR 2). */
  keyRow?: 'google-ai-key' | 'openai-api-key'
}

/**
 * Today's five names (`SettingsSection` in `src/settings/RitemarkSettingsProvider.ts`) and their new places (I61), and
 * Web pages' (Sprint 149, PR 4).
 */
export const LEGACY_SECTION_LANDINGS: Readonly<Record<string, SettingsLanding>> = {
  'google-docs': { section: 'sharing', anchor: 'settings-section-google-docs' },
  transcription: { section: 'advanced', anchor: 'settings-section-transcription' },
  'usage-data': { section: 'usage-data' },
  'google-ai-key': { section: 'ai-accounts', anchor: 'settings-section-google-ai-key', keyRow: 'google-ai-key' },
  'openai-api-key': { section: 'ai-accounts', anchor: 'settings-section-openai-api-key', keyRow: 'openai-api-key' },
  // Sprint 149, PR 4 (Codex's review of #668): the bar's Unpublish asking to connect Cloudflare again
  'web-pages': { section: 'sharing', anchor: 'settings-section-web-pages' },
}

/** Whether a way in names a place: one of today's five names, or a section's id. Anything else is ignored. */
export function isKnownLanding(name: unknown): name is string {
  return typeof name === 'string'
    && (Object.prototype.hasOwnProperty.call(LEGACY_SECTION_LANDINGS, name) || SETTINGS_SECTIONS.some((section) => section.id === name))
}

/** A way in's landing; an unknown name lands on the first section, as an opener with none does. */
export function landingFor(name: unknown): SettingsLanding {
  if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_SECTION_LANDINGS, name)) return LEGACY_SECTION_LANDINGS[name]
  if (typeof name === 'string' && SETTINGS_SECTIONS.some((section) => section.id === name)) return { section: name as SettingsSectionId }
  return { section: FIRST_SECTION }
}
