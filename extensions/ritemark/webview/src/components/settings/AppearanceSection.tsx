/**
 * Settings ▸ Appearance (Sprint 147, R4; experience 15, frame 4): Light and Dark as small pictures of the window, Text
 * size in chats in three steps, and the line on movement. Today's settings only: the theme (`workbench.colorTheme`
 * through `theme:set`, I1) and the chat's size (`ritemark.chat.fontSize`, I2).
 */

import { SegmentedControl } from '../ui/segmented-control'
import { SettingsNote, SettingsRow } from './SettingsRow'

export interface ThemeChoice {
  id: string
  label: string
  kind: 'light' | 'dark'
}

/** Text size in chats: the Experience lead's steps (answer 4). The exact size, 10 to 20, stays in All settings. */
export const CHAT_SIZES = [
  { size: 12, label: 'Smaller' },
  { size: 13, label: 'Usual' },
  { size: 15, label: 'Larger' },
] as const

/** The row's line: a size no step has was set in All settings, and shows as it is. */
export function chatSizeLine(size: number): string {
  return CHAT_SIZES.some((step) => step.size === size) ? 'In every chat, with any AI' : `${size} px, set in All settings`
}

/** The theme's short name, as drawn: "Light", "Dark". */
function themeName(theme: ThemeChoice): string {
  return theme.label.replace(/^Ritemark\s+/, '')
}

export function AppearanceSection({
  themes,
  currentTheme,
  onTheme,
  chatFontSize,
  onChatFontSize,
}: {
  themes: ThemeChoice[]
  currentTheme: string
  onTheme: (id: string) => void
  chatFontSize: number
  onChatFontSize: (size: number) => void
}) {
  return (
    <>
      <div data-settings-row="I1" className="mb-1.5 w-2/3 max-[560px]:w-full">
        <SegmentedControl
          variant="picture"
          aria-label="Theme"
          value={currentTheme}
          onValueChange={onTheme}
          options={themes.map((theme) => ({ value: theme.id, label: themeName(theme), picture: <ThemePicture kind={theme.kind} /> }))}
        />
      </div>
      <SettingsRow row="I2" name="Text size in chats" line={chatSizeLine(chatFontSize)}>
        <SegmentedControl
          aria-label="Text size in chats"
          value={String(chatFontSize)}
          onValueChange={(value) => onChatFontSize(Number(value))}
          options={CHAT_SIZES.map((step) => ({ value: String(step.size), label: step.label }))}
        />
      </SettingsRow>
      <SettingsNote icon="info">Movement follows this computer&apos;s Reduce motion setting.</SettingsNote>
    </>
  )
}

/**
 * A small picture of the window in the theme's own colours (the drawing's `.thm .pv`): the ground with the list's
 * lines, the desk with a title and two lines, the AI's column with its send button. Drawn here, not an image file, so
 * an extension release can change it.
 */
export function ThemePicture({ kind }: { kind: 'light' | 'dark' }) {
  const c = kind === 'dark'
    ? { ground: '#16132F', desk: '#1E1B4B', ai: '#1A1740', edge: 'rgba(199,210,254,.14)', line: 'rgba(199,210,254,.28)', title: '#F8FAFC', send: '#818CF8' }
    : { ground: '#F1F5F9', desk: '#FFFFFF', ai: '#F8FAFC', edge: '#E2E8F0', line: '#CBD5E1', title: '#1E1B4B', send: '#4338CA' }
  const bar = (left: number, top: number, width: number, height: number, background: string) => (
    <i className="absolute block rounded-[2px]" style={{ left, top, width, height, background }} />
  )
  return (
    <span
      aria-hidden="true"
      className="relative block h-24 overflow-hidden rounded-[7px] shadow-[0_0_0_1px_var(--r-hairline-strong)]"
      style={{ background: c.ground }}
    >
      {bar(8, 16, 24, 3, c.line)}
      {bar(8, 24, 18, 3, c.line)}
      {bar(8, 32, 21, 3, c.line)}
      <i className="absolute block rounded-t-[4px]" style={{ left: 38, top: 12, width: 78, height: 84, background: c.desk, boxShadow: `0 0 0 .5px ${c.edge}` }} />
      <i className="absolute block rounded-t-[4px]" style={{ left: 120, top: 12, width: 30, height: 84, background: c.ai, boxShadow: `0 0 0 .5px ${c.edge}` }} />
      {bar(48, 24, 44, 5, c.title)}
      {bar(48, 36, 58, 3, c.line)}
      {bar(48, 44, 50, 3, c.line)}
      <i className="absolute block rounded-[3px]" style={{ left: 126, top: 80, width: 18, height: 8, background: c.send }} />
    </span>
  )
}
