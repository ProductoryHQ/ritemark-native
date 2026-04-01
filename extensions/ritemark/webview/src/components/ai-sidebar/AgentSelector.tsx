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

export function AgentSelector() {
  const selectedAgent = useAISidebarStore((s) => s.selectedAgent);
  const selectedModel = useAISidebarStore((s) => s.selectedModel);
  const codexSelectedModel = useAISidebarStore((s) => s.codexSelectedModel);
  const agents = useAISidebarStore((s) => s.agents);
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const agenticEnabled = useAISidebarStore((s) => s.agenticEnabled);
  const selectAgent = useAISidebarStore((s) => s.selectAgent);
  const selectModel = useAISidebarStore((s) => s.selectModel);
  const selectCodexModel = useAISidebarStore((s) => s.selectCodexModel);

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
        : agents.find((a) => a.id === selectedAgent)?.label || 'Select agent...';

  function handleChange(value: string) {
    if (value.startsWith('claude-code:')) {
      const modelId = value.slice('claude-code:'.length);
      if (selectedAgent !== 'claude-code') {
        selectAgent('claude-code' as AgentId);
      }
      selectModel(modelId);
    } else if (value.startsWith('codex:')) {
      const modelId = value.slice('codex:'.length);
      if (selectedAgent !== 'codex') {
        selectAgent('codex' as AgentId);
      }
      selectCodexModel(modelId);
    } else {
      selectAgent(value as AgentId);
    }
  }

  return (
    <div className="px-3 py-2 border-b border-[var(--vscode-panel-border)]">
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs">
          <span className="truncate">{triggerLabel}</span>
        </SelectTrigger>
        <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
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
                    <span className="ml-1.5 text-[10px] opacity-50">{model.description}</span>
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
                    <span className="ml-1.5 text-[10px] opacity-50">{model.description}</span>
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
    </div>
  );
}
