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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted mt-4 mb-1 first:mt-0">
      {children}
    </p>
  )
}

function FieldRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-[11px] font-medium text-ink-muted uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
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

  return (
    <div
      className="w-[220px] flex-shrink-0 h-full overflow-y-auto border-r border-hairline"
      style={{ background: 'var(--vscode-editor-background)' }}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Header */}
        <h2 className="text-[15px] font-semibold text-ink-strong">Agent</h2>

        {/* ── Description (REQUIRED — routing text) ── */}
        <SectionLabel>Description</SectionLabel>

        <div className="flex flex-col gap-1">
          <Textarea
            id={descriptionId}
            value={description}
            onChange={e => set('description', e.target.value)}
            placeholder="When should Claude use this agent?"
            rows={4}
            className="text-[12px] leading-snug"
            aria-invalid={!description.trim()}
          />
          <p className="text-[10px] text-ink-muted leading-tight">
            {description.trim()
              ? 'Claude uses this to decide when to delegate to this agent.'
              : 'Required — without a description Claude never delegates to this agent.'}
          </p>
        </div>

        {/* ── Model ── */}
        <SectionLabel>Model</SectionLabel>

        <div className="flex flex-col gap-1.5">
          <Select value={modelSelectValue} onValueChange={handleModelSelect}>
            <SelectTrigger id={modelId} className="text-[12px] h-7" aria-label="Model">
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
              placeholder="e.g. claude-opus-4-8"
              className="text-[12px] h-7"
            />
          )}
        </div>

        {/* ── Tools ── */}
        <SectionLabel>Tools</SectionLabel>

        {grantedTools.length === 0 && (
          <p className="text-[11px] text-ink-muted leading-snug rounded px-2 py-1.5 bg-accent-soft">
            Inherits <strong>all</strong> tools (no restriction). Check tools below to restrict
            this agent to a specific set.
          </p>
        )}

        <div className="flex flex-col gap-0.5">
          {CLAUDE_TOOLS.map(tool => {
            const checked = grantedTools.includes(tool.name)
            return (
              <label
                key={tool.name}
                className="flex items-start gap-2 px-1 py-1 rounded cursor-pointer hover:bg-surface-soft group"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTool(tool.name)}
                  className="mt-0.5 accent-[var(--r-accent)] flex-shrink-0"
                />
                <span className="flex flex-col min-w-0">
                  <span className="text-[12px] text-ink-strong leading-tight font-mono">{tool.name}</span>
                  <span className="text-[10px] text-ink-muted leading-tight">{tool.description}</span>
                </span>
              </label>
            )
          })}
        </div>

        {/* Unknown / MCP tool names present in the file — preserved, never dropped */}
        {unknownTools.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-ink-muted">Also granted (kept as-is):</p>
            <div className="flex flex-wrap gap-1">
              {unknownTools.map(t => (
                <Pill key={t} variant="accent" className="font-mono text-[10px]" title="Tool name not in the standard list — preserved">
                  {t}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {/* ── Skills (preloaded into agent context) ── */}
        <SectionLabel>Skills</SectionLabel>

        {agentSkills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agentSkills.map(sid => {
              const skill = skills.find(s => s.id === sid)
              return (
                <Pill
                  key={sid}
                  variant="accent"
                  className="cursor-pointer group"
                  onClick={() => removeSkill(sid)}
                  title="Click to remove"
                >
                  {skill?.name ?? sid}
                  <span className="opacity-0 group-hover:opacity-100 ml-0.5">×</span>
                </Pill>
              )
            })}
          </div>
        )}

        <div className="relative">
          <Input
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            placeholder="Add skill…"
            className="text-[12px] h-7"
          />
          {filteredSkillSuggestions.length > 0 && (
            <div
              className="absolute z-50 left-0 right-0 top-full mt-0.5 rounded border border-hairline shadow-md max-h-40 overflow-y-auto"
              style={{ background: 'var(--vscode-editor-background)' }}
            >
              {filteredSkillSuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[12px] text-ink-strong hover:bg-accent-soft hover:text-accent-deep text-left"
                  onClick={() => addSkill(s.id)}
                >
                  <span>{s.name}</span>
                  {s.provenance && <ProvenanceBadge provenance={s.provenance} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Advanced (collapsed) ── */}
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          className="flex items-center gap-1 mt-4 text-[10px] font-semibold uppercase tracking-widest text-ink-muted hover:text-ink-strong"
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
          <div className="flex flex-col gap-3">
            <FieldRow label="Effort">
              <Select value={effort || UNSET} onValueChange={v => set('effort', v === UNSET ? '' : v)}>
                <SelectTrigger className="text-[12px] h-7" aria-label="Effort">
                  <SelectValue placeholder="Inherit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Inherit</SelectItem>
                  {EFFORT_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Memory">
              <Select value={memory || UNSET} onValueChange={v => set('memory', v === UNSET ? '' : v)}>
                <SelectTrigger className="text-[12px] h-7" aria-label="Memory">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>None</SelectItem>
                  {MEMORY_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Color">
              <Select value={color || UNSET} onValueChange={v => set('color', v === UNSET ? '' : v)}>
                <SelectTrigger className="text-[12px] h-7" aria-label="Color">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Default</SelectItem>
                  {COLOR_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        )}

        {/* ── Schedule ── */}
        <SectionLabel>Schedule</SectionLabel>
        <p className="text-[10px] text-ink-muted -mt-1">Run this agent automatically on a cron schedule.</p>

        <div className="flex flex-col gap-2">
          <ScheduleEditor
            cron={schedCron}
            onCronChange={cron => setSchedule({ cron })}
          />

          <FieldRow label="Label">
            <Input
              value={schedLabel}
              onChange={e => setSchedule({ label: e.target.value })}
              placeholder="e.g. Daily standup"
              className="text-[12px] h-7"
            />
          </FieldRow>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={schedEnabled}
              onCheckedChange={enabled => setSchedule({ enabled })}
              aria-label="Enable schedule"
            />
            <span className="text-[12px] text-ink-strong">Enable schedule</span>
          </label>
        </div>

        {/* ── Ritemark extension: linked flow ── */}
        <SectionLabel>Linked flow</SectionLabel>
        <p className="text-[10px] text-ink-muted -mt-1">Ritemark extension — not part of the Claude Code agent format.</p>

        {flows.length > 0 ? (
          <FieldRow label="Flow" htmlFor={flowId}>
            <Select
              value={routine || UNSET}
              onValueChange={val => set('routine', val === UNSET ? '' : val)}
            >
              <SelectTrigger id={flowId} className="text-[12px] h-7">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>None</SelectItem>
                {flows.map(stem => (
                  <SelectItem key={stem} value={stem}>{stem}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] text-ink-muted">No flows yet.</p>
            <button
              type="button"
              onClick={onCreateFlow}
              className="self-start text-[11px] text-accent-deep hover:underline"
            >
              + Create flow
            </button>
          </div>
        )}

      </div>

      {/* Routine value display (read-only if set from frontmatter directly) */}
      {routine && flows.length === 0 && (
        <div className="px-4 pb-4">
          <SectionLabel>Linked flow</SectionLabel>
          <Badge variant="outline">{routine}</Badge>
          <p className="text-[10px] text-ink-muted mt-1">Flow file not found in workspace.</p>
        </div>
      )}
    </div>
  )
}
