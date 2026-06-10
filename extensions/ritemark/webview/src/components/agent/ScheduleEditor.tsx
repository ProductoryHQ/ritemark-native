/**
 * ScheduleEditor — structured picker replacing the raw "Cron expression" input.
 *
 * Two modes selected via a compact segmented control:
 *   "Interval"  — preset minute/hour steps (*\/N)
 *   "Days"      — weekday chips + time input
 *
 * Falls back to an "Advanced (cron)" collapsible when the current cron string is
 * not representable by either mode.
 *
 * Props:
 *   cron          — current cron string (may be empty)
 *   onCronChange  — called with the new cron string whenever the UI changes
 */

import { useState, useCallback, useId, useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { FilterChip } from '../ui/filter-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Icon } from '../ui/Icon'
import {
  cronToUi,
  uiToCron,
  DEFAULT_UI_SCHEDULE,
  type UiSchedule,
  type ScheduleMode,
} from './cronSchedule'

// ── Helpers declared outside the component (stable refs, no closure issues) ──

// Day-selection presets surfaced as a dropdown; [] = every day (no cron restriction).
const DAY_PRESETS = [
  { value: 'everyday', label: 'Every day', days: [] as number[] },
  { value: 'weekdays', label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { value: 'weekend', label: 'Weekend', days: [6, 0] },
]

/** Match the current day selection to a preset value, or 'custom'. */
function dayPresetValue(days: number[]): string {
  const s = [...days].sort((a, b) => a - b)
  if (s.length === 0 || s.length === 7) return 'everyday'
  const eq = (a: number[]) => a.length === s.length && a.every((v, i) => v === s[i])
  if (eq([1, 2, 3, 4, 5])) return 'weekdays'
  if (eq([0, 6])) return 'weekend'
  return 'custom'
}

function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/)
  return parts.length === 5 && parts.every(p => /^[\d*/,\-]+$/.test(p))
}

// Monday-first weekday chips (incl. Sunday); values are cron dow numbers (0=Sun).
const WEEKDAYS = [
  { label: 'Mon', full: 'Monday', dow: 1 },
  { label: 'Tue', full: 'Tuesday', dow: 2 },
  { label: 'Wed', full: 'Wednesday', dow: 3 },
  { label: 'Thu', full: 'Thursday', dow: 4 },
  { label: 'Fri', full: 'Friday', dow: 5 },
  { label: 'Sat', full: 'Saturday', dow: 6 },
  { label: 'Sun', full: 'Sunday', dow: 0 },
]

const MINUTE_PRESETS = [5, 10, 15, 20, 30]
const HOUR_PRESETS = [1, 2, 3, 4, 6, 8, 12]

// ── Component ────────────────────────────────────────────────────────────────

interface ScheduleEditorProps {
  cron: string
  onCronChange: (cron: string) => void
}

export function ScheduleEditor({ cron, onCronChange }: ScheduleEditorProps) {
  const advancedRawId = useId()

  // Derive initial ui state from the incoming cron string once on mount / when
  // cron changes from outside (e.g. file loaded). Use a ref to track what we
  // last pushed out so we don't re-derive on our own writes.
  const lastEmittedCron = useRef<string>(cron)

  const derivedUi = cron ? cronToUi(cron) : null
  const startsAdvanced = cron !== '' && derivedUi === null

  const [mode, setMode] = useState<ScheduleMode>(derivedUi?.mode ?? DEFAULT_UI_SCHEDULE.mode)
  const [ui, setUi] = useState<UiSchedule>(derivedUi ?? DEFAULT_UI_SCHEDULE)
  const [advancedOpen, setAdvancedOpen] = useState(startsAdvanced)
  const [advancedRaw, setAdvancedRaw] = useState(cron)
  // true when we are in "advanced only" mode because cron can't be represented
  const [forcedAdvanced, setForcedAdvanced] = useState(startsAdvanced)

  // When the cron prop changes from outside (e.g. different agent loaded), re-sync.
  useEffect(() => {
    if (cron === lastEmittedCron.current) return   // our own write — ignore
    const parsed = cron ? cronToUi(cron) : null
    if (parsed) {
      setMode(parsed.mode)
      setUi(parsed)
      setAdvancedRaw(cron)
      setForcedAdvanced(false)
      setAdvancedOpen(false)
    } else {
      setAdvancedRaw(cron)
      setForcedAdvanced(cron !== '')
      setAdvancedOpen(cron !== '')
    }
  }, [cron])

  // Emit a new cron string from the structured UI. Keep the advanced raw field
  // in sync so the cron expression for the current selection is always visible.
  const emitFromUi = useCallback((next: UiSchedule) => {
    const c = uiToCron(next)
    lastEmittedCron.current = c
    setAdvancedRaw(c)
    onCronChange(c)
  }, [onCronChange])

  // Emit from the raw advanced input.
  const emitFromRaw = useCallback((raw: string) => {
    lastEmittedCron.current = raw
    onCronChange(raw)
  }, [onCronChange])

  // ── Segmented-control mode switch ────────────────────────────────────────

  const handleModeSwitch = useCallback((newMode: ScheduleMode) => {
    setMode(newMode)
    const next: UiSchedule = { ...ui, mode: newMode }
    setUi(next)
    emitFromUi(next)
  }, [ui, emitFromUi])

  // ── Interval handlers ────────────────────────────────────────────────────

  const handleIntervalN = useCallback((val: string) => {
    const n = parseInt(val, 10)
    if (isNaN(n)) return
    const next: UiSchedule = { ...ui, mode: 'interval', intervalN: n }
    setUi(next)
    emitFromUi(next)
  }, [ui, emitFromUi])

  const handleIntervalUnit = useCallback((val: string) => {
    if (val !== 'minutes' && val !== 'hours') return
    // Reset N to first valid preset for the unit
    const defaultN = val === 'minutes' ? 15 : 1
    const currentPresets = val === 'minutes' ? MINUTE_PRESETS : HOUR_PRESETS
    const safeN = currentPresets.includes(ui.intervalN) ? ui.intervalN : defaultN
    const next: UiSchedule = { ...ui, mode: 'interval', intervalUnit: val, intervalN: safeN }
    setUi(next)
    emitFromUi(next)
  }, [ui, emitFromUi])

  // ── Days handlers ────────────────────────────────────────────────────────

  const toggleDay = useCallback((dow: number) => {
    const alreadyAll = ui.days.length === 0   // 0-length = "all"
    const baseDays = alreadyAll ? [0, 1, 2, 3, 4, 5, 6] : ui.days
    const next: number[] = baseDays.includes(dow)
      ? baseDays.filter(d => d !== dow)
      : [...baseDays, dow]
    const nextUi: UiSchedule = { ...ui, mode: 'days', days: next }
    setUi(nextUi)
    emitFromUi(nextUi)
  }, [ui, emitFromUi])

  const setQuickDays = useCallback((days: number[]) => {
    const nextUi: UiSchedule = { ...ui, mode: 'days', days }
    setUi(nextUi)
    emitFromUi(nextUi)
  }, [ui, emitFromUi])

  const handleTime = useCallback((val: string) => {
    const nextUi: UiSchedule = { ...ui, mode: 'days', time: val }
    setUi(nextUi)
    emitFromUi(nextUi)
  }, [ui, emitFromUi])

  // ── Advanced handlers ────────────────────────────────────────────────────

  const handleAdvancedRaw = useCallback((val: string) => {
    setAdvancedRaw(val)
    emitFromRaw(val)
  }, [emitFromRaw])

  const handleSwitchBackToPicker = useCallback(() => {
    // Try to parse the current raw advanced value; fall back to default.
    const parsed = advancedRaw ? cronToUi(advancedRaw) : null
    const next = parsed ?? DEFAULT_UI_SCHEDULE
    setMode(next.mode)
    setUi(next)
    setForcedAdvanced(false)
    setAdvancedOpen(false)
    emitFromUi(next)
  }, [advancedRaw, emitFromUi])

  const isDayActive = (dow: number) =>
    ui.days.length === 0 || ui.days.includes(dow)

  const copyCron = useCallback(() => {
    void navigator.clipboard?.writeText(advancedRaw)
  }, [advancedRaw])

  // Human-readable summary of the current selection ("Runs daily at 09:00").
  const activePreset = dayPresetValue(ui.days)
  const summary = mode === 'interval'
    ? (
      <>Runs every <strong className="font-semibold text-accent-deep">
        {ui.intervalN} {ui.intervalUnit === 'minutes'
          ? (ui.intervalN === 1 ? 'minute' : 'minutes')
          : (ui.intervalN === 1 ? 'hour' : 'hours')}
      </strong></>
    )
    : (
      <>Runs <strong className="font-semibold text-accent-deep">
        {activePreset === 'everyday' ? 'daily'
          : activePreset === 'weekdays' ? 'on weekdays'
          : activePreset === 'weekend' ? 'on weekends'
          : 'on ' + WEEKDAYS.filter(w => ui.days.includes(w.dow)).map(w => w.label).join(', ')}
      </strong> at <strong className="font-semibold text-accent-deep">{ui.time}</strong></>
    )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2.5">

      {/* Segmented mode control — only show if not forced into Advanced */}
      {!forcedAdvanced && (
        <div
          className="flex w-full rounded-lg border border-hairline overflow-hidden"
          role="group"
          aria-label="Schedule mode"
        >
          {(
            [
              { value: 'interval' as ScheduleMode, label: 'Interval' },
              { value: 'days' as ScheduleMode, label: 'Days' },
            ] as const
          ).map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              className={
                'flex-1 rounded-none h-8 text-[12px] ' +
                (mode === value
                  ? 'bg-[var(--r-accent)] text-white font-semibold hover:bg-[var(--r-accent)] hover:text-white'
                  : 'text-ink-body')
              }
              onClick={() => handleModeSwitch(value)}
              aria-pressed={mode === value}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {/* ── Interval mode ── */}
      {!forcedAdvanced && mode === 'interval' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-body">Frequency</span>
          <div className="flex items-center gap-1.5">
            <Select
              value={String(ui.intervalN)}
              onValueChange={handleIntervalN}
            >
              <SelectTrigger className="h-8 text-[12px] w-[72px]" aria-label="Interval count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(ui.intervalUnit === 'minutes' ? MINUTE_PRESETS : HOUR_PRESETS).map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ui.intervalUnit}
              onValueChange={handleIntervalUnit}
            >
              <SelectTrigger className="h-8 text-[12px] flex-1" aria-label="Interval unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">minutes</SelectItem>
                <SelectItem value="hours">hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ── Days mode ── */}
      {!forcedAdvanced && mode === 'days' && (
        <div className="flex flex-col gap-2.5">
          {/* Recurrence — preset chips + weekday grid */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-body">Recurrence</span>
            <div className="flex flex-wrap gap-1">
              {DAY_PRESETS.map(p => {
                const selected = activePreset === p.value
                return (
                  <FilterChip
                    key={p.value}
                    selected={selected}
                    onClick={() => setQuickDays(p.days)}
                    className="rounded-full h-6 px-2.5 text-[11px] shadow-none"
                  >
                    {selected && <Icon name="check-circle" size={12} tone="active" />}
                    {p.label}
                  </FilterChip>
                )
              })}
              {activePreset === 'custom' && (
                <FilterChip selected className="rounded-full h-6 px-2.5 text-[11px] shadow-none">
                  <Icon name="check-circle" size={12} tone="active" />
                  Custom
                </FilterChip>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map(({ label, full, dow }) => {
                const active = isDayActive(dow)
                return (
                  <FilterChip
                    key={dow}
                    selected={active}
                    onClick={() => toggleDay(dow)}
                    title={full}
                    aria-label={full}
                    className="flex-col h-auto gap-0.5 px-0 py-1.5 justify-center rounded-md text-[10px] shadow-none"
                  >
                    <Icon
                      name={active ? 'check-circle' : 'circle'}
                      size={14}
                      tone={active ? 'active' : 'muted'}
                    />
                    {label}
                  </FilterChip>
                )
              })}
            </div>
          </div>

          {/* Time */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-body">Time</span>
            <input
              type="time"
              value={ui.time}
              onChange={e => handleTime(e.target.value)}
              className={[
                'h-8 w-full rounded-lg px-2.5 text-[12px]',
                'bg-surface text-ink-strong',
                'border border-hairline-strong',
                'focus:outline-none focus:border-accent focus:ring-[4px] focus:ring-[var(--r-ring-color)]',
              ].join(' ')}
              aria-label="Schedule time"
            />
          </div>
        </div>
      )}

      {/* ── Summary banner ── */}
      {!forcedAdvanced && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-2">
          <Icon name={mode === 'days' ? 'calendar' : 'clock'} size={16} tone="active" />
          <span className="text-[12px] text-ink-body">{summary}</span>
        </div>
      )}

      {/* ── Advanced / cron escape hatch ── */}
      {forcedAdvanced ? (
        /* Forced-advanced: cron isn't representable by a mode — raw field + back link */
        <div className="flex flex-col gap-1.5 rounded-lg border border-hairline p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-strong">Advanced (cron)</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px] text-ink-muted hover:text-ink-strong"
              onClick={handleSwitchBackToPicker}
            >
              ← Back to picker
            </Button>
          </div>
          <p className="text-[10px] text-ink-muted -mt-1">Use cron syntax for advanced scheduling.</p>
          <div className="flex items-center gap-1">
            <Input
              id={advancedRawId}
              value={advancedRaw}
              onChange={e => handleAdvancedRaw(e.target.value)}
              placeholder="min hour dom mon dow"
              className={`flex-1 text-[12px] h-8 font-mono bg-surface-soft border-transparent ${advancedRaw && !isValidCron(advancedRaw) ? 'border-destructive' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copyCron}
              aria-label="Copy cron expression"
              title="Copy"
            >
              <Icon name="copy" size={14} />
            </Button>
          </div>
          {advancedRaw && !isValidCron(advancedRaw) && (
            <p className="text-[10px] text-destructive">Invalid — use 5 fields: min hour dom month dow</p>
          )}
        </div>
      ) : (
        /* Collapsible advanced card */
        <div className="flex flex-col gap-1.5 rounded-lg border border-hairline p-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-stretch justify-start h-auto p-0 gap-1.5 text-[12px] font-medium text-ink-strong hover:bg-transparent"
            onClick={() => setAdvancedOpen(o => !o)}
            aria-expanded={advancedOpen}
          >
            <Icon
              name="caret-right"
              size={12}
              className={advancedOpen ? 'rotate-90 transition-transform' : 'transition-transform'}
            />
            Advanced (cron)
          </Button>

          {advancedOpen && (
            <>
              <p className="text-[10px] text-ink-muted">Use cron syntax for advanced scheduling.</p>
              <div className="flex items-center gap-1">
                <Input
                  id={advancedRawId}
                  value={advancedRaw}
                  onChange={e => handleAdvancedRaw(e.target.value)}
                  placeholder="min hour dom mon dow"
                  className={`flex-1 text-[12px] h-8 font-mono bg-surface-soft border-transparent ${advancedRaw && !isValidCron(advancedRaw) ? 'border-destructive' : ''}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={copyCron}
                  aria-label="Copy cron expression"
                  title="Copy"
                >
                  <Icon name="copy" size={14} />
                </Button>
              </div>
              {advancedRaw && !isValidCron(advancedRaw) && (
                <p className="text-[10px] text-destructive">Invalid — use 5 fields: min hour dom month dow</p>
              )}
            </>
          )}
        </div>
      )}

    </div>
  )
}
