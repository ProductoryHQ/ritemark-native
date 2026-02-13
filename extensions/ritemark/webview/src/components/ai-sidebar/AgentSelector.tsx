/**
 * AgentSelector — merged dropdown for agent + model selection.
 *
 * Ritemark Agent is a single option. Claude Code expands into
 * model sub-options (Sonnet, Opus, Haiku) shown as grouped items.
 * The trigger displays "Claude Code · Sonnet" etc.
 */

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
  const agents = useAISidebarStore((s) => s.agents);
  const models = useAISidebarStore((s) => s.models);
  const agenticEnabled = useAISidebarStore((s) => s.agenticEnabled);
  const selectAgent = useAISidebarStore((s) => s.selectAgent);
  const selectModel = useAISidebarStore((s) => s.selectModel);

  const visibleAgents = agents.filter((a) => !a.experimental || agenticEnabled);

  if (visibleAgents.length <= 1 && models.length === 0) return null;

  // Build the composite value: "ritemark-agent" or "claude-code:claude-sonnet-4-5"
  const currentValue =
    selectedAgent === 'claude-code'
      ? `claude-code:${selectedModel}`
      : selectedAgent;

  // Build display label for the trigger
  const currentModelLabel = models.find((m) => m.id === selectedModel)?.label;
  const triggerLabel =
    selectedAgent === 'claude-code' && currentModelLabel
      ? `Claude Code · ${currentModelLabel}`
      : agents.find((a) => a.id === selectedAgent)?.label || 'Select agent...';

  function handleChange(value: string) {
    if (value.startsWith('claude-code:')) {
      const modelId = value.slice('claude-code:'.length);
      if (selectedAgent !== 'claude-code') {
        selectAgent('claude-code' as AgentId);
      }
      selectModel(modelId);
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
          {/* Ritemark Agent — single item */}
          {visibleAgents
            .filter((a) => a.id !== 'claude-code')
            .map((agent) => (
              <SelectItem key={agent.id} value={agent.id} className="text-xs">
                {agent.label}
              </SelectItem>
            ))}

          {/* Claude Code — grouped by model */}
          {visibleAgents.some((a) => a.id === 'claude-code') && models.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px]">Claude Code</SelectLabel>
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
        </SelectContent>
      </Select>
    </div>
  );
}
