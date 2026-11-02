/**
 * Settings' parts (Sprint 147, W2; the kit's `.srow`, `.sgrp`): a row of a name, one line and its control; a group's
 * heading; a button with its tooltip; a link that opens in the browser through the host.
 *
 * `data-settings-row` names the inventory row a part draws (spec R1, I1–I64), so `settingsPage.test.ts` can find it.
 */

import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { vscode } from '../../lib/vscode'
import { cn } from '../../lib/utils'

export function SettingsRow({
  name,
  line,
  children,
  row,
  id,
  className,
}: {
  name: ReactNode
  line?: ReactNode
  /** The row's control or actions, at its right. */
  children?: ReactNode
  /** The inventory rows it draws (`I3 I4`). */
  row?: string
  id?: string
  className?: string
}) {
  return (
    <div id={id} data-settings-row={row} className={cn('flex scroll-mt-6 items-center gap-3.5 border-t border-hairline py-3.5', className)}>
      <div className="grid min-w-0 flex-1">
        <div className="text-[14px] font-semibold leading-5 text-ink-strong">{name}</div>
        {line ? <div className="text-[13px] leading-[18px] text-ink-muted">{line}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{children}</div> : null}
    </div>
  )
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-[22px] text-[11px] font-semibold uppercase leading-[14px] tracking-[0.5px] text-ink-strong">{children}</h3>
}

/** A line of its own under the rows, with an icon (frame 3's More tools, frame 4's Reduce motion). */
export function SettingsNote({ icon, children, row }: { icon: Parameters<typeof Icon>[0]['name']; children: ReactNode; row?: string }) {
  return (
    <div data-settings-row={row} className="mt-4 flex flex-wrap items-center gap-x-2 text-[13px] leading-[18px] text-ink-muted">
      <Icon name={icon} size={14} />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}

type ButtonProps = Parameters<typeof Button>[0]

/** The shared Button with its tooltip (R9): every button on Settings says what it does, or why it is off. */
export function TipButton({ tip, children, ...props }: ButtonProps & { tip: ReactNode }) {
  return (
    <Tooltip label={tip}>
      <Button {...props}>{children}</Button>
    </Tooltip>
  )
}

/** A link that opens in the browser, through the host's `openExternal` (R9). */
export function ExternalLink({ url, tip, children, className }: { url: string; tip?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Tooltip label={tip ?? `Opens ${new URL(url).host} in your browser`}>
      <Button
        variant="link"
        size="sm"
        className={cn('h-auto p-0 text-[13px]', className)}
        onClick={() => vscode.postMessage({ type: 'openExternal', url })}
      >
        {children}
      </Button>
    </Tooltip>
  )
}
