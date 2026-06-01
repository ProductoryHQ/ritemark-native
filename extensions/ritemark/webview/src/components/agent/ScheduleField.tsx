import { useState, useEffect, useId } from 'react'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

// Inline humanizer for common 5-part cron patterns (no external dependency needed).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmt(h: number, m: number): string {
  const hour = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  const min = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
  return `${hour}${min} ${ampm}`
}

function humanizeCron(expr: string): string | null {
  const p = expr.trim().split(/\s+/)
  if (p.length !== 5) return null
  const [min, hour, dom, month, dow] = p

  if (min === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') return 'Every minute'

  const everyMin = min.match(/^\*\/(\d+)$/)
  if (everyMin && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(everyMin[1])
    return `Every ${n} minute${n === 1 ? '' : 's'}`
  }

  if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') return 'Every hour'

  const everyHour = hour.match(/^\*\/(\d+)$/)
  if (min === '0' && everyHour && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(everyHour[1])
    return `Every ${n} hour${n === 1 ? '' : 's'}`
  }

  const mNum = parseInt(min)
  const hNum = parseInt(hour)
  const fixedTime =
    !Number.isNaN(mNum) && !Number.isNaN(hNum) &&
    !min.includes('*') && !min.includes('/') &&
    !hour.includes('*') && !hour.includes('/')

  if (fixedTime) {
    const t = fmt(hNum, mNum)
    if (dom === '*' && month === '*' && dow === '*') return `Daily at ${t}`
    if (dom === '*' && month === '*' && dow === '1-5') return `Weekdays at ${t}`
    if (dom === '*' && month === '*' && (dow === '0,6' || dow === '6,0')) return `Weekends at ${t}`

    const dowNum = parseInt(dow)
    if (dom === '*' && month === '*' && !Number.isNaN(dowNum) && !dow.includes(',') && !dow.includes('-') && !dow.includes('/')) {
      return `Every ${DAYS[dowNum % 7]} at ${t}`
    }

    const domNum = parseInt(dom)
    if (!Number.isNaN(domNum) && !dom.includes('*') && !dom.includes('/') && month === '*' && dow === '*') {
      const sfx = domNum === 1 ? 'st' : domNum === 2 ? 'nd' : domNum === 3 ? 'rd' : 'th'
      return `Monthly on the ${domNum}${sfx} at ${t}`
    }
  }

  return null
}

function isValidCron(expr: string): boolean {
  const p = expr.trim().split(/\s+/)
  if (p.length !== 5) return false
  // Simple structural check — each field must be non-empty
  return p.every(f => f.length > 0)
}

interface ScheduleFieldProps {
  value: string
  onChange: (val: string) => void
  k6Dismissed: boolean
  onDismissK6: () => void
}

export function ScheduleField({ value, onChange, k6Dismissed, onDismissK6 }: ScheduleFieldProps) {
  const id = useId()
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!value.trim()) {
      setPreview(null)
      setError(false)
      return
    }
    if (!isValidCron(value)) {
      setPreview(null)
      setError(true)
      return
    }
    const human = humanizeCron(value)
    setPreview(human ?? value.trim())
    setError(false)
  }, [value])

  const hasCron = value.trim().length > 0

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-[11px] font-medium text-ink-muted uppercase tracking-wide">
        Schedule
      </Label>

      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0 9 * * 1-5"
        className="text-[12px] h-7"
        aria-invalid={error}
      />

      {error && (
        <p className="text-[11px] text-ritemark-error leading-tight">
          Invalid cron expression
        </p>
      )}

      {!error && preview && (
        <p className="text-[11px] text-ink-muted leading-tight">{preview}</p>
      )}

      {hasCron && !k6Dismissed && (
        <div
          className="mt-1 rounded px-2.5 py-2 text-[11px] leading-snug"
          style={{ background: 'var(--vscode-inputValidation-warningBackground, #fffbe6)', color: 'var(--vscode-inputValidation-warningForeground, #6b5c00)', border: '1px solid var(--vscode-inputValidation-warningBorder, #e0c000)' }}
        >
          <span>Scheduled runs execute only while Ritemark is open. Background execution ships in Phase 2.</span>
          <button
            type="button"
            onClick={onDismissK6}
            className="ml-2 underline opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
