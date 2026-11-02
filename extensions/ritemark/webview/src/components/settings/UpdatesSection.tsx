/**
 * Settings ▸ Updates (Sprint 147, R7; experience 15, frame 7, and the Experience lead's answer 3): the version and the
 * last check in the lede; one card for an update on offer, one ready after a reload, one blocked or one that failed;
 * Check for updates when Ritemark starts; Check now with the last good and failed checks; the version line. Every part of
 * today's Update Center keeps a place (I45–I55), and the same `updates:*` messages go to the host.
 */

import { Icon } from '../ui/Icon'
import { Switch } from '../ui/switch'
import { extensionVersionLabel } from './versionLabel'
import { SettingsRow, TipButton } from './SettingsRow'

export interface UpdateCenter {
  state: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'paused' | 'restart-required' | 'blocked' | 'error'
  currentAppVersion: string
  currentExtensionVersion: string
  updatesEnabled: boolean
  lastCheckedAt: number
  lastSuccessfulCheckAt: number
  lastFailedCheckAt: number
  skippedVersion: string
  snoozeUntil: number
  pendingRestartVersion: string
  availableUpdate?: {
    action: 'full' | 'extension'
    version: string
    summary: string
    releaseDate?: string
    downloadSize?: number
  }
  feedSource: 'feed' | 'legacy' | 'none'
  error?: string
  blockedReason?: string
}

export type UpdateAction = 'updates:checkNow' | 'updates:install' | 'updates:skipVersion' | 'updates:pause' | 'updates:resume' | 'updates:reload'

/** "today at 09:12", "yesterday at 18:40", or the date and time; "never" for none. */
export function whenText(timestamp: number, now = Date.now()): string {
  if (!timestamp) return 'never'
  const at = new Date(timestamp)
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(new Date(now)) - day(at)) / 86_400_000)
  if (days === 0) return `today at ${time}`
  if (days === 1) return `yesterday at ${time}`
  return at.toLocaleString(undefined, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function dayText(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** The lede (I46): the version, then what the update check is doing or last did. */
export function updatesLede(center: UpdateCenter, checking: boolean): string {
  const version = `Ritemark ${center.currentAppVersion}.`
  if (checking) return `${version} Checking for updates…`
  if (center.state === 'up-to-date' && !center.pendingRestartVersion) return `${version} Up to date; it checked ${whenText(center.lastCheckedAt || center.lastSuccessfulCheckAt)}.`
  if (center.state === 'error') return `${version} The last check for updates failed.`
  if (center.state === 'blocked') return `${version} This update can't be installed here.`
  const last = center.lastCheckedAt || center.lastSuccessfulCheckAt
  return last ? `${version} It checked for updates ${whenText(last)}.` : `${version} It hasn't checked for updates yet.`
}

/** Check now's line (I48): the last good check, and the last failed one. */
export function checkNowLine(center: UpdateCenter): string {
  const good = center.lastSuccessfulCheckAt ? `Last check worked ${whenText(center.lastSuccessfulCheckAt)}.` : 'No check has worked yet.'
  const failed = center.lastFailedCheckAt ? `The last failed ${whenText(center.lastFailedCheckAt)}.` : 'None failed.'
  return `${good} ${failed}`
}

/** The version line (I51, I55): the app, the extension, and where updates come from. */
export function versionLine(center: UpdateCenter): string {
  const source = center.feedSource === 'feed'
    ? "from Ritemark's release feed"
    : center.feedSource === 'legacy'
      ? "from Ritemark's older release list"
      : 'no release information found'
  return `App ${center.currentAppVersion} · Extension ${extensionVersionLabel(center.currentExtensionVersion)} · ${source}`
}

export function UpdatesSection({
  center,
  updatesEnabled,
  checking,
  onToggle,
  onAction,
}: {
  center: UpdateCenter
  updatesEnabled: boolean
  checking: boolean
  onToggle: (on: boolean) => void
  onAction: (action: UpdateAction) => void
}) {
  const update = center.availableUpdate
  const skipped = Boolean(update && center.skippedVersion && center.skippedVersion === update.version)
  const paused = center.snoozeUntil > 0
  const reminderLine = skipped
    ? "You skipped this version, so Ritemark won't remind you of it."
    : paused ? `Ritemark won't remind you until ${dayText(center.snoozeUntil)}.` : null

  return (
    <>
      {center.pendingRestartVersion ? (
        <div data-settings-row="I52" className="mb-3.5 grid gap-2.5 rounded-[10px] bg-accent-soft px-4 py-3.5">
          <div>
            <div className="text-[14px] font-semibold leading-5 text-ink-strong">Ritemark {center.pendingRestartVersion} is installed</div>
            <div className="text-[13px] leading-[18px] text-ink-body">Ritemark reloads its window to finish, and your work stays as it is.</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TipButton tip="Reloads this window to start the new version" size="sm" onClick={() => onAction('updates:reload')}>
              <Icon name="arrow-counter-clockwise" size={14} />
              Reload window
            </TipButton>
          </div>
        </div>
      ) : update ? (
        <div data-settings-row="I53" className="mb-3.5 grid gap-2.5 rounded-[10px] bg-accent-soft px-4 py-3.5">
          <div>
            <div className="text-[14px] font-semibold leading-5 text-ink-strong">Ritemark {update.version} is ready</div>
            <div className="text-[13px] leading-[18px] text-ink-body">
              {update.action === 'full' ? 'A full app update' : 'A small update'}
              {formatSize(update.downloadSize) ? `, ${formatSize(update.downloadSize)}` : ''}.{' '}
              {update.summary || 'No release summary available.'}
            </div>
            {reminderLine && <div data-settings-row="I49 I50" className="mt-1 text-[13px] leading-[18px] text-ink-body">{reminderLine}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TipButton
              tip={update.action === 'full' ? 'Downloads the installer for the new app' : 'Installs the update, then asks to reload'}
              size="sm"
              onClick={() => onAction('updates:install')}
            >
              <Icon name="download" size={14} />
              {update.action === 'full' ? 'Download the installer' : 'Install update'}
            </TipButton>
            {reminderLine ? (
              <TipButton tip="Ritemark tells you about updates again" variant="ghost" size="sm" onClick={() => onAction('updates:resume')}>
                Turn reminders back on
              </TipButton>
            ) : (
              <>
                <TipButton tip="No more reminders for this version; it stays available here" variant="ghost" size="sm" onClick={() => onAction('updates:skipVersion')}>
                  Skip this version
                </TipButton>
                <TipButton tip="No reminders for 7 days" variant="ghost" size="sm" onClick={() => onAction('updates:pause')}>
                  Remind me in 7 days
                </TipButton>
              </>
            )}
          </div>
        </div>
      ) : null}

      {center.state === 'blocked' && center.blockedReason && (
        <div data-settings-row="I54" role="status" className="mb-3.5 rounded-[10px] bg-surface-muted px-4 py-3.5 text-[13px] leading-[18px] text-ink-body">
          {center.blockedReason}
        </div>
      )}
      {center.state === 'error' && center.error && (
        <div data-settings-row="I54" role="status" className="mb-3.5 rounded-[10px] bg-surface-muted px-4 py-3.5 text-[13px] leading-[18px] text-ink-body">
          Could not check for updates: {center.error}
        </div>
      )}

      <SettingsRow row="I45" name="Check for updates when Ritemark starts" line="Ritemark tells you in the bell when one is ready">
        <Switch aria-label="Check for updates when Ritemark starts" checked={updatesEnabled} onCheckedChange={onToggle} />
      </SettingsRow>
      <SettingsRow row="I47 I48" name="Check now" line={checkNowLine(center)}>
        <TipButton
          tip="Asks Ritemark's release feed for a newer version"
          variant="outline"
          size="sm"
          aria-busy={checking}
          onClick={() => onAction('updates:checkNow')}
        >
          <Icon name={checking ? 'circle-notch' : 'arrows-clockwise'} size={14} className={checking ? 'animate-spin' : undefined} />
          {checking ? 'Checking…' : 'Check now'}
        </TipButton>
      </SettingsRow>
      {paused && !update && (
        <SettingsRow row="I50" name="Reminders paused" line={`Until ${dayText(center.snoozeUntil)}, Ritemark won't tell you when an update is ready.`}>
          <TipButton tip="Ritemark tells you about updates again" variant="outline" size="sm" onClick={() => onAction('updates:resume')}>
            Turn back on
          </TipButton>
        </SettingsRow>
      )}
      {center.skippedVersion && !skipped && !paused && (
        <SettingsRow row="I49" name="Skipped version" line={`You skipped ${center.skippedVersion}, so Ritemark won't remind you of it.`}>
          <TipButton tip="Ritemark tells you about updates again" variant="outline" size="sm" onClick={() => onAction('updates:resume')}>
            Turn back on
          </TipButton>
        </SettingsRow>
      )}
      <SettingsRow row="I51 I55" name="Version" line={versionLine(center)} />
    </>
  )
}
