/**
 * AgentSelector — merged dropdown for agent + model selection.
 *
 * Ritemark Agent is a single option. Claude expands into
 * model sub-options (Sonnet, Opus, Haiku) shown as grouped items.
 * The trigger displays "Claude · Sonnet" etc.
 */

import React from 'react';
import { useAISidebarStore } from './store';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '../ui/select';
import type { AgentId } from './types';

/**
 * Trim model descriptions to a tight 3-4 word tail.
 *
 * Many SDK descriptions repeat the model version that already appears in the
 * row label (e.g. "Sonnet 4.6 · Best for everyday tasks"). Strip the prefix
 * up to and including " · " when present, then keep at most 4 words so the
 * dropdown row never overflows the sidebar width.
 */
function shortenDescription(description: string | undefined): string {
  if (!description) return '';
  const dot = description.indexOf(' · ');
  const tail = dot >= 0 ? description.slice(dot + 3) : description;
  const words = tail.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words.join(' ');
  return words.slice(0, 4).join(' ') + '…';
}

export function AgentSelector() {
  const selectedAgent = useAISidebarStore((s) => s.selectedAgent);
  const selectedModel = useAISidebarStore((s) => s.selectedModel);
  const codexSelectedModel = useAISidebarStore((s) => s.codexSelectedModel);
  const agents = useAISidebarStore((s) => s.agents);
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const agenticEnabled = useAISidebarStore((s) => s.agenticEnabled);
  const pendingRuntime = useAISidebarStore((s) => s.pendingRuntime);
  const selectAgent = useAISidebarStore((s) => s.selectAgent);
  const selectModel = useAISidebarStore((s) => s.selectModel);
  const selectCodexModel = useAISidebarStore((s) => s.selectCodexModel);
  const setPendingRuntime = useAISidebarStore((s) => s.setPendingRuntime);

  const visibleAgents = agents.filter((a) => !a.experimental || agenticEnabled);

  if (visibleAgents.length <= 1 && models.length === 0) return null;

  // Build the composite value: "ritemark-agent", "claude-code:model", or "codex:model"
  const currentValue =
    selectedAgent === 'claude-code'
      ? `claude-code:${selectedModel}`
      : selectedAgent === 'codex'
        ? `codex:${codexSelectedModel}`
        : selectedAgent;

  // Build display label for the trigger
  const currentModelLabel = models.find((m) => m.id === selectedModel)?.label;
  const currentCodexModelLabel = codexModels.find((m) => m.id === codexSelectedModel)?.label;
  const triggerLabel =
    selectedAgent === 'claude-code' && currentModelLabel
      ? `Claude · ${currentModelLabel}`
      : selectedAgent === 'codex' && currentCodexModelLabel
        ? `Codex · ${currentCodexModelLabel}`
        : agents.find((a) => a.id === selectedAgent)?.label || (selectedAgent === 'ritemark-agent' ? 'Legacy Agent' : 'Select agent...');

  function handleChange(value: string) {
    if (value.startsWith('claude-code:')) {
      const modelId = value.slice('claude-code:'.length);
      if (selectedAgent !== 'claude-code') {
        selectAgent('claude-code' as AgentId);
      }
      selectModel(modelId);
      setPendingRuntime({ runtimeId: 'claude-code', modelId });
    } else if (value.startsWith('codex:')) {
      const modelId = value.slice('codex:'.length);
      if (selectedAgent !== 'codex') {
        selectAgent('codex' as AgentId);
      }
      selectCodexModel(modelId);
      setPendingRuntime({ runtimeId: 'codex', modelId });
    } else {
      selectAgent(value as AgentId);
    }
  }

  return (
    <div className="px-3 py-2 border-b border-[var(--r-hairline)]">
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs">
          <span className="truncate">{triggerLabel}</span>
        </SelectTrigger>

        <SelectContent className="max-w-[280px]">
          {/* Claude — grouped by model */}
          {visibleAgents.some((a) => a.id === 'claude-code') && models.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px]">Claude</SelectLabel>
                {models.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={`claude-code:${model.id}`}
                    className="text-xs"
                  >
                    {model.label}
                    {model.description && (
                      <span className="ml-1.5 text-[10px] opacity-60">
                        {shortenDescription(model.description)}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}

          {/* Codex — grouped by model */}
          {visibleAgents.some((a) => a.id === 'codex') && codexModels.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px]">Codex</SelectLabel>
                {codexModels.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={`codex:${model.id}`}
                    className="text-xs"
                  >
                    {model.label}
                    {model.description && (
                      <span className="ml-1.5 text-[10px] opacity-60">
                        {shortenDescription(model.description)}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}

          {/* Ritemark Document Agent — last */}
          {visibleAgents
            .filter((a) => a.id !== 'claude-code' && a.id !== 'codex')
            .map((agent) => (
              <React.Fragment key={agent.id}>
                <SelectSeparator />
                <SelectItem value={agent.id} className="text-xs">
                  {agent.label}
                </SelectItem>
              </React.Fragment>
            ))}
        </SelectContent>
      </Select>

      {/* Plan / Edit mode toggle — Codex only (Claude plan mode is lifecycle-driven) */}
      {pendingRuntime.runtimeId === 'codex' && (
        <div className="flex gap-1.5 mt-1.5">
          {(['edit', 'plan'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPendingRuntime({ mode })}
              className={[
                'inline-flex items-center px-2.5 h-6 text-[11px] font-medium cursor-pointer',
                'border transition-colors duration-100',
                'rounded-[4px]',
                pendingRuntime.mode === mode
                  ? 'bg-[var(--r-accent-soft)] border-[var(--r-accent)] text-[var(--r-accent-deep)]'
                  : 'bg-[var(--r-surface)] border-[var(--r-hairline)] text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]',
              ].join(' ')}
            >
              {mode === 'edit' ? 'Edit' : 'Plan'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
