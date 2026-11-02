/**
 * Settings' frame (Sprint 147, R2, W2; experience 15, frames 2–7): the sections in a list on the left, the shared Tabs
 * drawn vertical, and one section at a time beside it, with its title and its one-line lede. Under 640 of desk the list
 * becomes the shared Select at the top of the page (the Experience lead's answer 8), so nothing is cut and nothing
 * scrolls sideways.
 */

import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import type { SettingsSectionId, SettingsSectionInfo } from './settingsSections'

export function SettingsPage({
  sections,
  section,
  onSectionChange,
  lede,
  children,
}: {
  sections: readonly SettingsSectionInfo[]
  section: SettingsSectionId
  onSectionChange: (section: SettingsSectionId) => void
  /** A section's lede drawn from data (Updates: the version and the last check), over the list's own. */
  lede?: Partial<Record<SettingsSectionId, ReactNode>>
  /** Each section's rows. */
  children: Partial<Record<SettingsSectionId, ReactNode>>
}) {
  return (
    <Tabs
      orientation="vertical"
      value={section}
      onValueChange={(value) => onSectionChange(value as SettingsSectionId)}
      className="flex min-h-full gap-8 px-4 pb-10 pt-14 text-ink-body max-[640px]:flex-col max-[640px]:gap-4 max-[640px]:pt-6"
    >
      <TabsList aria-label="Settings sections" className="w-[184px] shrink-0 self-start max-[640px]:hidden">
        {sections.map((item) => (
          <TabsTrigger key={item.id} value={item.id} data-settings-section={item.id}>
            <Icon name={item.icon} size={14} />
            {item.name}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="hidden max-[640px]:block">
        <Select value={section} onValueChange={(value) => onSectionChange(value as SettingsSectionId)}>
          <SelectTrigger aria-label="Section" className="w-full max-w-[320px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <span className="inline-flex items-center gap-2">
                  <Icon name={item.icon} size={14} />
                  {item.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sections.map((item) => (
        <TabsContent key={item.id} value={item.id} className="min-w-0 max-w-[520px] flex-1 text-[14px] leading-[21px]">
          <h2 className="mb-1 text-[20px] font-semibold leading-[26px] text-ink-strong">{item.name}</h2>
          <p className="mb-[18px] text-ink-muted">{lede?.[item.id] ?? item.lede}</p>
          {children[item.id]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
