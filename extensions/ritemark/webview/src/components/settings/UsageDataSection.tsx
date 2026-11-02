/**
 * Settings ▸ Usage data (Sprint 147, R6; experience 15, frame 6): the one switch, in the welcome's words (I43), and
 * Privacy policy and Terms of use (I44).
 */

import { Switch } from '../ui/switch'
import { ExternalLink, SettingsRow } from './SettingsRow'

export const PRIVACY_URL = 'https://ritemark.app/en/privacy/'
export const TERMS_URL = 'https://ritemark.app/en/terms/'

export function usageDataLine(usageData: { on: boolean; fromRitemark1: boolean } | undefined): string {
  if (!usageData?.on) return 'Off. Never your documents, chats or names.'
  return usageData.fromRitemark1 ? 'On, as you chose in Ritemark 1. Never your documents, chats or names.' : 'On. Never your documents, chats or names.'
}

export function UsageDataSection({
  usageData,
  onChange,
}: {
  usageData: { on: boolean; fromRitemark1: boolean } | undefined
  onChange: (on: boolean) => void
}) {
  return (
    <div id="settings-section-usage-data" className="scroll-mt-6">
      <SettingsRow row="I43" name="Share anonymous usage data" line={usageDataLine(usageData)}>
        <Switch aria-label="Share anonymous usage data" checked={usageData?.on ?? false} onCheckedChange={onChange} />
      </SettingsRow>
      <p data-settings-row="I44" className="mt-1 flex items-center gap-1.5 text-[13px] leading-[18px] text-ink-muted">
        <ExternalLink url={PRIVACY_URL}>Privacy policy</ExternalLink>
        <span aria-hidden="true">·</span>
        <ExternalLink url={TERMS_URL}>Terms of use</ExternalLink>
      </p>
    </div>
  )
}
