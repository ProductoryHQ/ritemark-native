/**
 * Agent Configurator Panel — edits .claude/agents/*.md frontmatter.
 *
 * Built on the REAL Claude Code subagent schema. Reference:
 * docs/development/sprints/sprint-77-unified-agent-library-p1/agent-protocols-reference.md
 *
 * Field semantics (per spec):
 *  - description: REQUIRED — Claude uses it to decide when to delegate to this agent
 *  - model:       alias (sonnet/opus/haiku), full model ID, or absent = inherit
 *  - tools:       comma-separated string of canonical PascalCase names; absent = inherits ALL tools
 *  - skills:      YAML list of skills preloaded into the agent's context
 *  - effort/memory/color: optional behavior tuning
 *  - routine:     RITEMARK EXTENSION (agent ↔ flow link) — not part of the Claude Code format
 */
import { useState, useCallback, useId } from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import { Pill } from '../ui/pill'
import { Badge } from '../ui/badge'
import { Icon } from '../ui/Icon'
import { ProvenanceBadge } from './ProvenanceBadge'
import { ScheduleEditor } from './ScheduleEditor'
import {
  CLAUDE_TOOLS,
  MODEL_ALIASES,
  EFFORT_OPTIONS,
  MEMORY_OPTIONS,
  COLOR_OPTIONS,
  parseToolsField,
  serializeToolsField,
} from './agentSchema'
import { describeSchedule } from './cronSchedule'

export interface AgentSkill {
  id: string
  name: string
  provenance?: 'claude' | 'codex' | 'shared'
}

export interface ScheduleFrontmatter {
  cron?: string
  label?: string
  enabled?: boolean
}

export interface AgentFrontmatter {
  [key: string]: string | string[] | number | boolean | ScheduleFrontmatter | undefined
}

interface AgentConfiguratorPanelProps {
  frontmatter: AgentFrontmatter
  flows: string[]
  skills: AgentSkill[]
  onFrontmatterChange: (fm: AgentFrontmatter) => void
  onCreateFlow: () => void
}

/**
 * Ritemark 2.0 (experience 31; kit: theme.html .cfg): a setting is its label in the column's caps, 6 above the
 * control, and 16 under it.
 */
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-semibold uppercase leading-[14px] tracking-[0.5px] text-ink-muted">
        {label}
      </Label>
      {children}
    </div>
  )
}

/** Every field's box: 28 high, radius 8, the strong hairline, on the desk (kit: .cfg .in). */
const FIELD_BOX = 'h-auto min-h-[28px] rounded-lg border-0 bg-surface px-2.5 py-[5px] text-[12px] leading-[18px] text-ink-strong shadow-[inset_0_0_0_1px_var(--r-hairline-strong)] focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_1px_var(--r-accent)]'

/** How many tools show before "N more" (the drawing shows six). */
const TOOLS_FOLDED = 6

function Check({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={'mt-px grid h-3.5 w-3.5 flex-none place-items-center rounded ' + (checked ? 'bg-[var(--r-accent)] text-[var(--vscode-button-foreground,#fff)]' : 'shadow-[inset_0_0_0_1px_var(--r-hairline-strong)]')}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"><polyline points="40 144 96 200 224 72" /></svg>
      )}
    </span>
  )
}

/** Select value used for the "custom model ID" mode. */
const CUSTOM_MODEL = '__custom__'
/** Select value meaning "field absent → inherit/none". */
const UNSET = '__unset__'


export function AgentConfiguratorPanel({
  frontmatter,
  flows,
  skills,
  onFrontmatterChange,
  onCreateFlow,
}: AgentConfiguratorPanelProps) {
  const descriptionId = useId()
  const modelId = useId()
  const flowId = useId()
  const [skillInput, setSkillInput] = useState('')
  const [customModelMode, setCustomModelMode] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const fm = frontmatter
  const description = typeof fm.description === 'string' ? fm.description : ''
  const model = typeof fm.model === 'string' ? fm.model : ''
  const routine = typeof fm.routine === 'string' ? fm.routine : ''
  const effort = typeof fm.effort === 'string' ? fm.effort : ''
  const memory = typeof fm.memory === 'string' ? fm.memory : ''
  const color = typeof fm.color === 'string' ? fm.color : ''
  const agentSkills: string[] = Array.isArray(fm.skills) ? (fm.skills as string[]) : []

  const rawSchedule = fm.schedule && typeof fm.schedule === 'object' && !Array.isArray(fm.schedule)
    ? fm.schedule as ScheduleFrontmatter
    : undefined
  const schedCron = rawSchedule?.cron ?? ''
  const schedLabel = rawSchedule?.label ?? ''
  const schedEnabled = rawSchedule?.enabled ?? false

  // Tools: parse from comma-separated string OR array → canonical names.
  // Empty = "inherits all tools" (per spec), NOT "no tools".
  const grantedTools = parseToolsField(fm.tools)
  const knownNames = CLAUDE_TOOLS.map(t => t.name)
  const unknownTools = grantedTools.filter(t => !knownNames.includes(t))

  /** Set a frontmatter key; empty/undefined values DELETE the key (= inherit/default per spec). */
  const set = useCallback((key: string, value: AgentFrontmatter[string]) => {
    const next = { ...fm }
    const isEmpty =
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) {
      delete next[key]
    } else {
      next[key] = value
    }
    onFrontmatterChange(next)
  }, [fm, onFrontmatterChange])

  const setSchedule = useCallback((patch: Partial<ScheduleFrontmatter>) => {
    const current: ScheduleFrontmatter = rawSchedule ?? {}
    const next = { ...current, ...patch }
    const isEmpty = !next.cron && !next.label && !next.enabled
    set('schedule', isEmpty ? undefined : next)
  }, [rawSchedule, set])

  const toggleTool = useCallback((toolName: string) => {
    const next = grantedTools.includes(toolName)
      ? grantedTools.filter(t => t !== toolName)
      : [...grantedTools, toolName]
    // Empty list = remove the field entirely → agent inherits all tools
    set('tools', next.length > 0 ? serializeToolsField(next) : '')
  }, [grantedTools, set])

  const addSkill = useCallback((skillId: string) => {
    if (!agentSkills.includes(skillId)) {
      set('skills', [...agentSkills, skillId])
    }
    setSkillInput('')
  }, [agentSkills, set])

  const removeSkill = useCallback((skillId: string) => {
    set('skills', agentSkills.filter(s => s !== skillId))
  }, [agentSkills, set])

  // Model select state: inherit | alias | custom ID
  const isAlias = MODEL_ALIASES.includes(model)
  const modelSelectValue = customModelMode
    ? CUSTOM_MODEL
    : model === '' ? UNSET : isAlias ? model : CUSTOM_MODEL

  const handleModelSelect = useCallback((val: string) => {
    if (val === CUSTOM_MODEL) {
      setCustomModelMode(true)
      return
    }
    setCustomModelMode(false)
    set('model', val === UNSET ? '' : val)
  }, [set])

  const filteredSkillSuggestions = skillInput.trim().length > 0
    ? skills.filter(s => s.name.toLowerCase().includes(skillInput.toLowerCase()) && !agentSkills.includes(s.id))
    : []

  const toolsShown = toolsExpanded ? CLAUDE_TOOLS : CLAUDE_TOOLS.slice(0, TOOLS_FOLDED)

  return (
    <div
      className="h-full w-[240px] flex-shrink-0 overflow-y-auto border-r border-t border-hairline bg-surface pb-4 pl-4 pr-3 pt-2"
    >
      {/* Header */}
      <h2 className="mb-3 mt-2 text-[13px] font-semibold leading-5 text-ink-strong">Agent</h2>

      {/* ── Description (REQUIRED — routing text) ── */}
      <Field label="Description" htmlFor={descriptionId}>
        <Textarea
          id={descriptionId}
          value={description}
          onChange={e => set('description', e.target.value)}
          placeholder="When should Claude use this agent?"
          rows={2}
          className={FIELD_BOX + ' max-h-[126px] resize-none'}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
          aria-invalid={!description.trim()}
        />
        {!description.trim() && (
          <p className="mt-1.5 text-[11px] leading-[14px] text-ink-muted">
            Required — without a description Claude never delegates to this agent.
          </p>
        )}
      </Field>

      {/* ── Model ── */}
      <Field label="Model" htmlFor={modelId}>
        <Select value={modelSelectValue} onValueChange={handleModelSelect}>
          <SelectTrigger id={modelId} className={FIELD_BOX} aria-label="Model">
            <SelectValue placeholder="Inherit (default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Inherit (default)</SelectItem>
            <SelectItem value="sonnet">Sonnet</SelectItem>
            <SelectItem value="opus">Opus</SelectItem>
            <SelectItem value="haiku">Haiku</SelectItem>
            <SelectItem value={CUSTOM_MODEL}>Custom model ID…</SelectItem>
          </SelectContent>
        </Select>
        {modelSelectValue === CUSTOM_MODEL && (
          <Input
            value={isAlias ? '' : model}
            onChange={e => set('model', e.target.value)}
            placeholder="Provider model ID"
            className={FIELD_BOX + ' mt-1.5'}
          />
        )}
      </Field>

      {/* ── Tools ── */}
      <Field label="Tools">
        {grantedTools.length === 0 && (
          <p className="mb-1.5 text-[11px] leading-[14px] text-ink-muted">
            Inherits <strong>all</strong> tools (no restriction). Check tools below to restrict
            this agent to a specific set.
          </p>
        )}
        <div className="flex flex-col">
          {toolsShown.map(tool => {
            const checked = grantedTools.includes(tool.name)
            return (
              <label key={tool.name} className="flex cursor-pointer items-start gap-2 rounded px-1 py-[3px] hover:bg-surface-soft">
                <input type="checkbox" checked={checked} onChange={() => toggleTool(tool.name)} className="sr-only" />
                <Check checked={checked} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-[12px] leading-4 text-ink-strong">{tool.name}</span>
                  <span className="text-[11px] leading-[14px] text-ink-muted">{tool.description}</span>
                </span>
              </label>
            )
          })}
        </div>
        {CLAUDE_TOOLS.length > TOOLS_FOLDED && (
          <button
            type="button"
            onClick={() => setToolsExpanded(open => !open)}
            className="px-1 text-left text-[12px] leading-5 text-ink-muted hover:text-ink-strong"
            aria-expanded={toolsExpanded}
          >
            {toolsExpanded ? 'Fewer' : `${CLAUDE_TOOLS.length - TOOLS_FOLDED} more`}
          </button>
        )}

        {/* Unknown / MCP tool names present in the file — preserved, never dropped */}
        {unknownTools.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1">
            <p className="text-[11px] leading-[14px] text-ink-muted">Also granted (kept as-is):</p>
            <div className="flex flex-wrap gap-1.5">
              {unknownTools.map(t => (
                <Pill key={t} variant="accent" className="font-mono text-[11px]" title="Tool name not in the standard list — preserved">
                  {t}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </Field>

      {/* ── Skills (preloaded into agent context) ── */}
      <Field label="Skills">
        {agentSkills.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {agentSkills.map(sid => {
              const skill = skills.find(s => s.id === sid)
              return ( /* the skill's folder name, as the Agents column shows it */
                <button
                  key={sid}
                  type="button"
                  onClick={() => removeSkill(sid)}
                  title={skill ? `${skill.name}: remove this skill` : 'Remove this skill'}
                  className="inline-flex h-6 items-center gap-1 rounded-md bg-[var(--r-accent-soft)] pl-2 pr-1.5 text-[12px] font-medium leading-6 text-[var(--r-accent)]"
                >
                  {sid}
                  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round"><line x1="200" y1="56" x2="56" y2="200" /><line x1="200" y1="200" x2="56" y2="56" /></svg>
                </button>
              )
            })}
          </div>
        )}

        <div className="relative">
          <Input
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            placeholder="Add skill…"
            className={FIELD_BOX}
          />
          {filteredSkillSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--r-hairline),0_10px_24px_-6px_rgba(30,27,75,0.16)]">
              {filteredSkillSuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="flex h-7 w-full items-center justify-between rounded px-2 text-left text-[12px] text-ink-strong hover:bg-surface-soft"
                  onClick={() => addSkill(s.id)}
                >
                  <span>{s.name}</span>
                  {s.provenance && <ProvenanceBadge provenance={s.provenance} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* ── Schedule ── */}
      {/* The schedule is one field, as drawn ("Not scheduled", or when it runs); it opens the editor under it */}
      <Field label="Schedule">
        <button
          type="button"
          onClick={() => setScheduleOpen(open => !open)}
          aria-expanded={scheduleOpen}
          className={FIELD_BOX + ' flex w-full items-center justify-between text-left'}
        >
          <span className={schedCron ? '' : 'text-ink-muted'}>{describeSchedule(schedCron)}</span>
          <Icon name="caret-down" size={12} className={scheduleOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {scheduleOpen && (
          <div className="mt-2">
            <p className="mb-1.5 text-[11px] leading-[14px] text-ink-muted">Run this agent automatically on a cron schedule.</p>
            <ScheduleEditor
              cron={schedCron}
              onCronChange={cron => setSchedule({ cron })}
            />
          </div>
        )}
      </Field>
      {(scheduleOpen || !!schedCron) && (
        <>
          <Field label="Label">
            <Input
              value={schedLabel}
              onChange={e => setSchedule({ label: e.target.value })}
              placeholder="e.g. Daily standup"
              className={FIELD_BOX}
            />
          </Field>
          <label className="mb-4 flex cursor-pointer select-none items-center gap-2">
            <Switch
              checked={schedEnabled}
              onCheckedChange={enabled => setSchedule({ enabled })}
              aria-label="Enable schedule"
            />
            <span className="text-[12px] text-ink-strong">Enable schedule</span>
          </label>
        </>
      )}

      {/* ── Ritemark extension: linked flow ── */}
      <Field label="Linked flow" htmlFor={flowId}>
        <p className="mb-1.5 text-[11px] leading-[14px] text-ink-muted">Ritemark extension — not part of the Claude Code agent format.</p>
        {flows.length > 0 ? (
          <Select
            value={routine || UNSET}
            onValueChange={val => set('routine', val === UNSET ? '' : val)}
          >
            <SelectTrigger id={flowId} className={FIELD_BOX}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>None</SelectItem>
              {flows.map(stem => (
                <SelectItem key={stem} value={stem}>{stem}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : routine ? (
          <>
            <Badge variant="outline">{routine}</Badge>
            <p className="mt-1.5 text-[11px] leading-[14px] text-ink-muted">Flow file not found in workspace.</p>
          </>
        ) : (
          <button
            type="button"
            onClick={onCreateFlow}
            className="text-[12px] leading-5 text-[var(--r-accent)] hover:underline"
          >
            + Create flow
          </button>
        )}
      </Field>

      {/* ── Advanced (collapsed) ── */}
      <button
        type="button"
        onClick={() => setAdvancedOpen(o => !o)}
        className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.5px] text-ink-muted hover:text-ink-strong"
        aria-expanded={advancedOpen}
      >
        <Icon
          name="caret-right"
          size={12}
          className={advancedOpen ? 'rotate-90 transition-transform' : 'transition-transform'}
        />
        Advanced
      </button>

      {advancedOpen && (
        <div className="mt-2">
          <Field label="Effort">
            <Select value={effort || UNSET} onValueChange={v => set('effort', v === UNSET ? '' : v)}>
              <SelectTrigger className={FIELD_BOX} aria-label="Effort">
                <SelectValue placeholder="Inherit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Inherit</SelectItem>
                {EFFORT_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Memory">
            <Select value={memory || UNSET} onValueChange={v => set('memory', v === UNSET ? '' : v)}>
              <SelectTrigger className={FIELD_BOX} aria-label="Memory">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>None</SelectItem>
                {MEMORY_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Color">
            <Select value={color || UNSET} onValueChange={v => set('color', v === UNSET ? '' : v)}>
              <SelectTrigger className={FIELD_BOX} aria-label="Color">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Default</SelectItem>
                {COLOR_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </div>
  )
}
