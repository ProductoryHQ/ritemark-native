import { useState, useCallback, useId } from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { FilterChip } from '../ui/filter-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Pill } from '../ui/pill'
import { Badge } from '../ui/badge'
import { ProvenanceBadge } from './ProvenanceBadge'
import { ScheduleField } from './ScheduleField'

// Runtime options
const RUNTIME_OPTIONS = [
  { value: 'claude', label: 'Claude', authKey: 'claude_local' },
  { value: 'codex',  label: 'Codex',  authKey: 'codex_local'  },
  { value: 'openai', label: 'OpenAI', authKey: 'openai_api'   },
] as const

// Allowed tools with descriptions
const TOOL_OPTIONS: Array<{ id: string; label: string; description: string }> = [
  { id: 'bash',        label: 'Bash',          description: 'Run shell commands' },
  { id: 'read',        label: 'Read files',     description: 'Read file contents' },
  { id: 'write',       label: 'Write files',    description: 'Create and edit files' },
  { id: 'edit',        label: 'Edit files',     description: 'Make targeted edits' },
  { id: 'glob',        label: 'Glob',           description: 'Find files by pattern' },
  { id: 'grep',        label: 'Grep',           description: 'Search file contents' },
  { id: 'web_fetch',   label: 'Web fetch',      description: 'Fetch URLs' },
  { id: 'web_search',  label: 'Web search',     description: 'Search the web' },
  { id: 'mcp',         label: 'MCP tools',      description: 'All MCP server tools' },
]

export interface AgentSkill {
  id: string
  name: string
  provenance?: 'claude' | 'codex' | 'shared'
}

export interface AgentFrontmatter {
  [key: string]: string | string[] | number | boolean | undefined
}

interface AgentConfiguratorPanelProps {
  frontmatter: AgentFrontmatter
  flows: string[]
  skills: AgentSkill[]
  authStatus: Record<string, boolean>
  k6Dismissed: boolean
  onFrontmatterChange: (fm: AgentFrontmatter) => void
  onDismissK6: () => void
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

export function AgentConfiguratorPanel({
  frontmatter,
  flows,
  skills,
  authStatus,
  k6Dismissed,
  onFrontmatterChange,
  onDismissK6,
  onCreateFlow,
}: AgentConfiguratorPanelProps) {
  const modelId = useId()
  const flowId = useId()
  const [skillInput, setSkillInput] = useState('')

  const fm = frontmatter
  const runtime = typeof fm.agent === 'string' ? fm.agent : ''
  const runtimeModel = typeof fm.model === 'string' ? fm.model : ''
  const schedule = typeof fm.schedule === 'string' ? fm.schedule : ''
  const routine = typeof fm.routine === 'string' ? fm.routine : ''
  const agentSkills: string[] = Array.isArray(fm.skills) ? (fm.skills as string[]) : []
  const allowedTools: string[] = Array.isArray(fm.tools) ? (fm.tools as string[]) : []

  const set = useCallback((key: string, value: AgentFrontmatter[string]) => {
    onFrontmatterChange({ ...fm, [key]: value })
  }, [fm, onFrontmatterChange])

  const toggleTool = useCallback((toolId: string) => {
    const next = allowedTools.includes(toolId)
      ? allowedTools.filter(t => t !== toolId)
      : [...allowedTools, toolId]
    set('tools', next)
  }, [allowedTools, set])

  const addSkill = useCallback((skillId: string) => {
    if (!agentSkills.includes(skillId)) {
      set('skills', [...agentSkills, skillId])
    }
    setSkillInput('')
  }, [agentSkills, set])

  const removeSkill = useCallback((skillId: string) => {
    set('skills', agentSkills.filter(s => s !== skillId))
  }, [agentSkills, set])

  const selectedRuntime = RUNTIME_OPTIONS.find(r => r.value === runtime)
  const authKey = selectedRuntime?.authKey
  const isAuthenticated = authKey ? authStatus[authKey] : false

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

        {/* ── Runtime ── */}
        <SectionLabel>Runtime</SectionLabel>

        {/* Runtime picker chips */}
        <div className="flex flex-wrap gap-1.5">
          {RUNTIME_OPTIONS.map(opt => (
            <FilterChip
              key={opt.value}
              selected={runtime === opt.value}
              onClick={() => set('agent', runtime === opt.value ? '' : opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>

        {/* Auth status dot */}
        {runtime && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: isAuthenticated ? 'var(--ritemark-success, #22c55e)' : 'var(--ritemark-error, #ef4444)' }}
            />
            <span className="text-[11px] text-ink-muted">
              {isAuthenticated ? 'Connected' : 'Not configured'}
            </span>
          </div>
        )}

        {/* Model */}
        <FieldRow label="Model" htmlFor={modelId}>
          <Input
            id={modelId}
            value={runtimeModel}
            onChange={e => set('model', e.target.value)}
            placeholder="e.g. claude-opus-4-8"
            className="text-[12px] h-7"
          />
        </FieldRow>

        {/* ── Schedule ── */}
        <SectionLabel>Schedule</SectionLabel>

        <ScheduleField
          value={schedule}
          onChange={val => set('schedule', val)}
          k6Dismissed={k6Dismissed}
          onDismissK6={onDismissK6}
        />

        {/* ── Linked flow ── */}
        <SectionLabel>Linked flow</SectionLabel>

        {flows.length > 0 ? (
          <FieldRow label="Flow" htmlFor={flowId}>
            <Select
              value={routine || '__none__'}
              onValueChange={val => set('routine', val === '__none__' ? '' : val)}
            >
              <SelectTrigger id={flowId} className="text-[12px] h-7">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
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

        {/* ── Skills ── */}
        <SectionLabel>Skills</SectionLabel>

        {/* Selected skill tags */}
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

        {/* Autocomplete input */}
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

        {/* ── Allowed tools ── */}
        <SectionLabel>Allowed tools</SectionLabel>

        <div className="flex flex-col gap-0.5">
          {TOOL_OPTIONS.map(tool => {
            const checked = allowedTools.includes(tool.id)
            return (
              <label
                key={tool.id}
                className="flex items-start gap-2 px-1 py-1 rounded cursor-pointer hover:bg-surface-soft group"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTool(tool.id)}
                  className="mt-0.5 accent-[var(--r-accent)] flex-shrink-0"
                />
                <span className="flex flex-col min-w-0">
                  <span className="text-[12px] text-ink-strong leading-tight">{tool.label}</span>
                  <span className="text-[10px] text-ink-muted leading-tight">{tool.description}</span>
                </span>
              </label>
            )
          })}
        </div>

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
