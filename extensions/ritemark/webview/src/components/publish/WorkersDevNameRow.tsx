/**
 * The workers.dev name row (Sprint 149, PR 4; spec R5; the Experience lead's answer 5): one row above Address in the
 * first Publish sheet after connecting, only while the account has no workers.dev name. Pre-filled by the host with
 * "pages" and four digits, never the person's or the company's name.
 *
 * PR 3's sheet (`PublishSheet.tsx`) places it; until then nothing draws it. It holds no account data beyond the name.
 */

import { Input } from '../ui/input'
import { NAME_ROW, webSafeName } from './workersDevName'

export function WorkersDevNameRow({
  value,
  onChange,
  taken,
}: {
  value: string
  onChange: (name: string) => void
  /** The host answered "taken or not allowed": the line shows, and Publish waits. */
  taken: boolean
}) {
  return (
    <div className="grid gap-1 py-2">
      <label htmlFor="publish-workers-dev-name" className="text-[13px] font-semibold leading-[18px] text-ink-strong">{NAME_ROW.label}</label>
      <div className="flex items-center gap-1 text-[13px] text-ink-body">
        <Input
          id="publish-workers-dev-name"
          value={value}
          onChange={(event) => onChange(webSafeName(event.target.value))}
          aria-invalid={taken || undefined}
          aria-describedby="publish-workers-dev-name-help"
          spellCheck={false}
          autoComplete="off"
          className="h-7 w-[160px]"
        />
        <span>.workers.dev</span>
      </div>
      {taken ? (
        <p id="publish-workers-dev-name-help" role="alert" className="text-[13px] leading-[18px] text-ink-strong">{NAME_ROW.taken}</p>
      ) : (
        <p id="publish-workers-dev-name-help" className="text-[13px] leading-[18px] text-ink-muted">{NAME_ROW.help}</p>
      )}
    </div>
  )
}
