/**
 * Node Config Panel Component
 *
 * Right sidebar for editing selected node properties.
 * Shows different fields based on node type.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../ui/Icon';
import { stepInfo } from './stepKinds';
import { PanelHeader } from './PanelHeader';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useFlowEditorStore, useSelectedNode } from './stores/flowEditorStore';
import type {
  TriggerNodeData,
  LLMNodeData,
  ImageNodeData,
  SaveFileNodeData,
  ClaudeCodeNodeData,
  CodexNodeData,
  FlowInput,
} from './stores/flowEditorStore';
import { cn } from '../../lib/utils';
import { vscode } from '../../lib/vscode';
import { PromptTextArea } from './PromptTextArea';
import {
  CODEX_DEFAULT_MODEL_SENTINEL,
  getCodexModelFromSelectValue,
  getCodexModelSelectValue,
} from './codexModelSelect';

export function NodeConfigPanel() {
  const selectedNode = useSelectedNode();
  const updateNodeData = useFlowEditorStore((state) => state.updateNodeData);
  const deleteNode = useFlowEditorStore((state) => state.deleteNode);
  const selectNode = useFlowEditorStore((state) => state.selectNode);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!selectedNode) {
    return (
      <div className="h-full px-4 py-3">
        <div className="mt-8 text-center text-[var(--r-ink-muted)]">
          <p className="text-[13px]">Select a step to edit it</p>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    selectNode(null);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    deleteNode(selectedNode.id);
    setShowDeleteConfirm(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const isTriggerNode = selectedNode.type === 'triggerNode';
  const step = stepInfo(selectedNode.type);
  const nodeLabel = (selectedNode.data as { label?: string }).label || 'this node';

  return (
    <div className="flex h-full flex-col">
      {/* Header (kit: .props .top): the step's kind and name, and close */}
      <PanelHeader
        lead={
          <span className={'rm-step-chip ' + (step?.kind ?? 'ai')} aria-hidden="true">
            <Icon name={step?.icon ?? 'lightning'} size={14} tone="inherit" />
          </span>
        }
        title={step?.name ?? 'Step'}
        onClose={handleClose}
      />

      {/* Content based on node type */}
      <div className="flex-1 overflow-y-auto space-y-4 px-4 pb-4">
        {selectedNode.type === 'triggerNode' && (
          <TriggerNodeConfig
            nodeId={selectedNode.id}
            data={selectedNode.data as TriggerNodeData}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          />
        )}

        {selectedNode.type === 'llmNode' && (
          <LLMNodeConfig
            nodeId={selectedNode.id}
            data={selectedNode.data as LLMNodeData}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          />
        )}

        {selectedNode.type === 'imageNode' && (
          <ImageNodeConfig
            nodeId={selectedNode.id}
            data={selectedNode.data as ImageNodeData}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          />
        )}

        {selectedNode.type === 'saveFileNode' && (
          <SaveFileNodeConfig
            nodeId={selectedNode.id}
            data={selectedNode.data as SaveFileNodeData}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          />
        )}

        {selectedNode.type === 'claudeCodeNode' && (
          <ClaudeCodeNodeConfig
            nodeId={selectedNode.id}
            data={selectedNode.data as ClaudeCodeNodeData}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          />
        )}

        {selectedNode.type === 'codexNode' && (
          <CodexNodeConfig
            nodeId={selectedNode.id}
            data={selectedNode.data as CodexNodeData}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          />
        )}

        {/* Delete at the end of the step's fields (not for the Trigger). Sprint 144 P4: it scrolls with the fields, so
            it never sits on the scroll area's edge cutting through Temperature and Max Tokens. */}
        {!isTriggerNode && (
          <div className="pt-2">
            {showDeleteConfirm ? (
              <div className="p-3 rounded bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)]">
                <p className="text-sm text-[var(--r-ink-strong)] mb-3">
                  Delete "{nodeLabel}"? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Tooltip label="Remove this step from the flow for good" className="flex-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteConfirm}
                      className="w-full bg-[var(--r-error)] text-white hover:opacity-90"
                    >
                      <Icon name="trash" size={14} className="mr-1" />
                      Delete
                    </Button>
                  </Tooltip>
                  <Tooltip label="Keep this step" className="flex-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDeleteCancel}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ) : (
              <Tooltip label="Remove this step from the flow">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteClick}
                  className="-ml-2 h-7 gap-1.5 px-2 text-[13px] text-[var(--r-error)] hover:text-[var(--r-error)] has-[>svg]:px-2" /* kit: .props .rm */
                >
                  <Icon name="trash" size={14} tone="inherit" />
                  Delete node
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Field container with label
interface FieldProps {
  label: string;
  children: React.ReactNode;
  description?: React.ReactNode;
}

function Field({ label, children, description }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[var(--r-ink-strong)]">{label}</Label>
      {children}
      {description && (
        <p className="text-xs text-[var(--r-ink-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A count that moves when a key is added or removed in Settings (the host's `flow:keysChanged`, Sprint 145 R5), so a
 * step panel's model list asks the host again: back from "Add it in Settings", the sentence goes.
 */
function useKeysChanged(): number {
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'flow:keysChanged') setChanges((count) => count + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return changes;
}

/** What fixes a step's missing key, as the host names it (`flow:models`' `errorAction`): Settings at that key. */
interface StepKeyAction {
  label: string;
  tooltip?: string;
  settingsSection: string;
}

/**
 * A step that can't run without its key says so in one sentence, with the fix as a link (the Experience lead's
 * words, experiences 13 and 31: "This step needs an OpenAI API key to run. Add it in Settings"). No warning sign. The
 * AI step and the image step show it the same way (Sprint 144 for the Google image step; Sprint 145 R5, #580).
 */
export function StepKeyNotice({ text, action }: { text: string; action: StepKeyAction }) {
  return (
    <>
      {text}{' '}
      <Tooltip label={action.tooltip ?? action.label}>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => vscode.postMessage({ type: 'flow:openSettings', section: action.settingsSection })}
        >
          {action.label}
        </Button>
      </Tooltip>
    </>
  );
}

// Textarea with VS Code styling
interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function TextArea({ className, ...props }: TextAreaProps) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full min-h-[80px] px-3 py-2 text-sm rounded',
        'bg-[var(--vscode-input-background)]',
        'text-[var(--vscode-input-foreground)]',
        'border border-[var(--vscode-input-border)]',
        'focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]',
        'placeholder:text-[var(--vscode-input-placeholderForeground)]',
        'resize-y',
        className
      )}
    />
  );
}

// Trigger Node Configuration
interface TriggerNodeConfigProps {
  nodeId: string;
  data: TriggerNodeData;
  onUpdate: (data: Partial<TriggerNodeData>) => void;
}

function TriggerNodeConfig({ data, onUpdate }: TriggerNodeConfigProps) {
  const inputs = data.inputs || [];

  const addInput = () => {
    const newInput: FlowInput = {
      id: `input-${Date.now()}`,
      type: 'text',
      label: `Input ${inputs.length + 1}`,
      required: true,
      defaultValue: '',
    };
    onUpdate({ inputs: [...inputs, newInput] });
  };

  const removeInput = (inputId: string) => {
    onUpdate({ inputs: inputs.filter((i) => i.id !== inputId) });
  };

  const updateInput = (inputId: string, updates: Partial<FlowInput>) => {
    onUpdate({
      inputs: inputs.map((i) =>
        i.id === inputId ? { ...i, ...updates } : i
      ),
    });
  };

  return (
    <>
      <Field label="Node Label">
        <Input
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Trigger"
        />
      </Field>

      <div className="pt-2 border-t border-[var(--r-hairline)]">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs font-semibold text-[var(--r-ink-strong)]">
            Flow inputs
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addInput}
            className="h-7 px-2 text-xs"
          >
            <Icon name="plus" size={14} className="mr-1" />
            Add input
          </Button>
        </div>

        {inputs.length === 0 ? (
          <p className="text-xs text-[var(--r-ink-muted)] italic">
            No inputs. Click "Add Input" to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {inputs.map((input, index) => (
              <div
                key={input.id}
                className="p-3 rounded bg-[var(--vscode-editor-background)] border border-[var(--r-hairline)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--r-ink-muted)]">
                    Input {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInput(input.id)}
                    className="h-6 w-6 p-0 text-[var(--r-error)]"
                  >
                    <Icon name="x" size={14} />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Input
                    value={input.label}
                    onChange={(e) =>
                      updateInput(input.id, { label: e.target.value })
                    }
                    placeholder="Input label..."
                    className="h-8 text-sm"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={input.type}
                      onValueChange={(value: 'text' | 'file') =>
                        updateInput(input.id, { type: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={input.required ? 'required' : 'optional'}
                      onValueChange={(value) =>
                        updateInput(input.id, { required: value === 'required' })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    value={input.defaultValue || ''}
                    onChange={(e) =>
                      updateInput(input.id, { defaultValue: e.target.value })
                    }
                    placeholder="Default value (optional)"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// LLM Node Configuration
interface LLMNodeConfigProps {
  nodeId: string;
  data: LLMNodeData;
  onUpdate: (data: Partial<LLMNodeData>) => void;
}

// Model config is received from extension - use helper functions
import { getLLMModels, getDefaultLLMModel, getDefaultImageModel, modelOptionsWithPersistedSelection, modelListWaiting, offeredImageModels, setFetchedImageModels } from '../../config/modelConfig';

function LLMNodeConfig({ nodeId, data, onUpdate }: LLMNodeConfigProps) {
  const provider = data.provider || 'openai';
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sprint 145 R5 (#580): what fixes the error, when the host names it (no key for the provider: Settings at that key)
  const [errorAction, setErrorAction] = useState<StepKeyAction | null>(null);
  const keysChanged = useKeysChanged();
  // Sprint 144 P4: the known list and the saved model stay usable while the host refreshes the list; the picker waits
  // only when it has no list at all. A saved model missing from the list stays visible, as on the Image step.
  const modelOptions = modelOptionsWithPersistedSelection(models, data.model);
  const waiting = modelListWaiting(isLoading, models.length);

  // Fetch models from API when provider changes
  useEffect(() => {
    // Set fallback immediately so dropdown has options
    setModels(getLLMModels(provider));
    setIsLoading(true);
    setError(null);
    setErrorAction(null);

    // Request models from extension
    vscode.postMessage({
      type: 'flow:getModels',
      provider,
      modelType: 'llm'
    });

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'flow:models' && message.provider === provider && message.modelType === 'llm') {
        setIsLoading(false);
        // A missing key comes with the list (Sprint 145 R5): the picker keeps working, and the panel says what's missing
        setError(message.error ?? null);
        setErrorAction(message.errorAction ?? null);
        if (message.models && message.models.length > 0) {
          setModels(message.models);
        }
        // If empty, keep fallback models
      }
    };

    window.addEventListener('message', handleMessage);

    // Timeout fallback - use fallback models if no response in 5s
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [provider, keysChanged]);

  // Handle provider change - reset model to first available
  const handleProviderChange = (newProvider: 'openai' | 'gemini') => {
    onUpdate({
      provider: newProvider,
      model: getDefaultLLMModel(newProvider)
    });
  };

  return (
    <>
      <Field label="Label">
        <Input
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Enter label..."
        />
      </Field>

      <Field label="Provider">
        <Select
          value={provider}
          onValueChange={(value: 'openai' | 'gemini') => handleProviderChange(value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Model"
        description={error && errorAction
          ? <StepKeyNotice text={error} action={errorAction} />
          : error
          ? `⚠️ ${error}`
          : waiting
            ? 'Loading models...'
            : modelOptions.unavailable
              ? 'Saved model is no longer available. Choose a replacement.'
              : undefined}
      >
        <Select
          // Sprint 141 R4: an unset step shows the model it runs on (the catalog's default), as its card does.
          value={data.model || getDefaultLLMModel(provider) || models[0]?.id || ''}
          onValueChange={(value) => onUpdate({ model: value })}
          disabled={waiting}
        >
          <SelectTrigger>
            <SelectValue placeholder={waiting ? 'Loading...' : 'Select model'} />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="System Prompt" description="Optional context for the AI">
        <PromptTextArea
          value={data.systemPrompt || ''}
          onChange={(val) => onUpdate({ systemPrompt: val })}
          placeholder="You are a helpful assistant..."
          nodeId={nodeId}
        />
      </Field>

      <Field
        label="User Prompt"
        description="Type / to use what an earlier step made."
      >
        <PromptTextArea
          value={data.userPrompt || ''}
          onChange={(val) => onUpdate({ userPrompt: val })}
          placeholder="Write about the topic..."
          nodeId={nodeId}
          className="min-h-[120px]"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Temperature" description="0-2, higher = more creative">
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={data.temperature ?? 0.7}
            onChange={(e) =>
              onUpdate({ temperature: parseFloat(e.target.value) || 0.7 })
            }
          />
        </Field>

        <Field label="Max Tokens">
          <Input
            type="number"
            min={1}
            max={128000}
            value={data.maxTokens ?? 2000}
            onChange={(e) =>
              onUpdate({ maxTokens: parseInt(e.target.value) || 2000 })
            }
          />
        </Field>
      </div>
    </>
  );
}

// Image Input Selector - allows selecting image sources from file inputs and upstream nodes
interface ImageInputSelectorProps {
  nodeId: string;
  selectedImages: string[];
  onChange: (images: string[]) => void;
}

function ImageInputSelector({ nodeId, selectedImages, onChange }: ImageInputSelectorProps) {
  const nodes = useFlowEditorStore((state) => state.nodes);
  const edges = useFlowEditorStore((state) => state.edges);

  // Find available image sources:
  // 1. Trigger file inputs (type: 'file')
  // 2. Upstream Image nodes
  const availableSources = React.useMemo(() => {
    const sources: Array<{ id: string; label: string; type: 'file' | 'node' }> = [];

    // Find trigger node for file inputs
    const triggerNode = nodes.find((n) => n.type === 'triggerNode');
    if (triggerNode) {
      const triggerData = triggerNode.data as TriggerNodeData;
      for (const input of triggerData.inputs || []) {
        if (input.type === 'file') {
          sources.push({
            id: `input:${input.label}`,
            label: `${input.label} (file input)`,
            type: 'file',
          });
        }
      }
    }

    // Find upstream image nodes (nodes that connect TO this node)
    const upstreamNodeIds = edges
      .filter((e) => e.target === nodeId)
      .map((e) => e.source);

    for (const upstreamId of upstreamNodeIds) {
      const upstreamNode = nodes.find((n) => n.id === upstreamId);
      if (upstreamNode?.type === 'imageNode') {
        const label = (upstreamNode.data as { label?: string }).label || upstreamId;
        sources.push({
          id: `node:${upstreamId}`,
          label: `${label} (image node)`,
          type: 'node',
        });
      }
    }

    return sources;
  }, [nodes, edges, nodeId]);

  const toggleSource = (sourceId: string) => {
    if (selectedImages.includes(sourceId)) {
      onChange(selectedImages.filter((id) => id !== sourceId));
    } else {
      onChange([...selectedImages, sourceId]);
    }
  };

  if (availableSources.length === 0) {
    return (
      <Field label="Input Images" description="Add file inputs to Trigger or connect upstream Image nodes">
        <div className="text-xs text-[var(--r-ink-muted)] italic p-2 rounded bg-[var(--vscode-editor-background)]">
          No image sources available
        </div>
      </Field>
    );
  }

  return (
    <Field label="Input Images" description="Select images to use as reference">
      <div className="space-y-1">
        {availableSources.map((source) => (
          <label
            key={source.id}
            className={cn(
              'flex items-center gap-2 p-2 rounded cursor-pointer text-sm',
              'hover:bg-[var(--r-surface-soft)]',
              selectedImages.includes(source.id) && 'bg-[var(--r-accent-soft)]'
            )}
          >
            <input
              type="checkbox"
              checked={selectedImages.includes(source.id)}
              onChange={() => toggleSource(source.id)}
              className="rounded"
            />
            <span>{source.label}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

// Image Node Configuration
interface ImageNodeConfigProps {
  nodeId: string;
  data: ImageNodeData;
  onUpdate: (data: Partial<ImageNodeData>) => void;
}

function ImageNodeConfig({ nodeId, data, onUpdate }: ImageNodeConfigProps) {
  const provider = data.provider || 'openai';
  // Sprint 144 P4: the list the step's card reads too (`offeredImageModels`), so both name the same model
  const [models, setModels] = React.useState<Array<{ id: string; name: string }>>(
    offeredImageModels(provider)
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Sprint 144: what fixes the error, when the host names it (an image step with no key: Settings at that key)
  const [errorAction, setErrorAction] = React.useState<StepKeyAction | null>(null);
  const keysChanged = useKeysChanged();
  const modelOptions = modelOptionsWithPersistedSelection(models, data.model);
  const waiting = modelListWaiting(loading, models.length); // Sprint 144 P4, as on the LLM step

  // Fetch models when provider changes
  React.useEffect(() => {
    // Reset to fallback immediately when provider changes
    setModels(offeredImageModels(provider));
    setLoading(true);
    setError(null);
    setErrorAction(null);

    // Request image models from extension
    vscode.postMessage({ type: 'flow:getModels', provider, modelType: 'image' });

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'flow:models' && message.provider === provider && message.modelType === 'image') {
        setLoading(false);
        if (message.error) {
          setError(message.error);
          setErrorAction(message.errorAction ?? null);
          // Keep fallback models (already set)
        } else if (message.models && message.models.length > 0) {
          setModels(message.models);
          setFetchedImageModels(provider, message.models);
        }
        // If empty, keep fallback models
      }
    };

    window.addEventListener('message', handleMessage);

    // Timeout fallback
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [provider, keysChanged]);

  // Handle provider change - reset model to first available
  const handleProviderChange = (newProvider: 'openai' | 'gemini') => {
    onUpdate({
      provider: newProvider,
      model: getDefaultImageModel(newProvider)
    });
  };

  return (
    <>
      <Field label="Label">
        <Input
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Enter label..."
        />
      </Field>

      <Field label="Provider">
        <Select
          value={provider}
          onValueChange={(value: 'openai' | 'gemini') => handleProviderChange(value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Model"
        description={waiting
          ? 'Loading models...'
          : modelOptions.unavailable
            ? 'Saved model is no longer available. Choose a replacement.'
            : error && errorAction
              ? <StepKeyNotice text={error} action={errorAction} />
              : error ? `⚠️ ${error}` : undefined}
      >
        <Select
          // Sprint 141 R4: an unset step shows the model it runs on, as the run's default.
          value={data.model || getDefaultImageModel(provider) || models[0]?.id || ''}
          onValueChange={(value) => onUpdate({ model: value })}
          disabled={waiting}
        >
          <SelectTrigger>
            <SelectValue placeholder={waiting ? 'Loading...' : 'Select model'} />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Prompt"
        description="Type / to use what an earlier step made."
      >
        <PromptTextArea
          value={data.prompt || ''}
          onChange={(val) => onUpdate({ prompt: val })}
          placeholder="A serene landscape with mountains..."
          nodeId={nodeId}
          className="min-h-[100px]"
        />
      </Field>

      <ImageInputSelector
        nodeId={nodeId}
        selectedImages={data.inputImages || []}
        onChange={(images) => onUpdate({ inputImages: images })}
      />

      {/* Show action and fidelity options only when images are selected */}
      {data.inputImages && data.inputImages.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Action" description="How to use input images">
            <Select
              value={data.action || 'auto'}
              onValueChange={(value: 'auto' | 'generate' | 'edit') =>
                onUpdate({ action: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (recommended)</SelectItem>
                <SelectItem value="generate">Generate new</SelectItem>
                <SelectItem value="edit">Edit image</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Fidelity" description="Preserve faces/logos">
            <Select
              value={data.inputFidelity || 'low'}
              onValueChange={(value: 'low' | 'high') =>
                onUpdate({ inputFidelity: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <Field label="Size">
        <Select
          value={data.size || '1024x1024'}
          onValueChange={(value: '1024x1024' | '1792x1024' | '1024x1792') =>
            onUpdate({ size: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1024x1024">Square (1024x1024)</SelectItem>
            <SelectItem value="1792x1024">Landscape (1792x1024)</SelectItem>
            <SelectItem value="1024x1792">Portrait (1024x1792)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Quality">
          <Select
            value={data.quality || 'standard'}
            onValueChange={(value: 'standard' | 'hd') =>
              onUpdate({ quality: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="hd">HD</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Style">
          <Select
            value={data.style || 'natural'}
            onValueChange={(value: 'natural' | 'vivid') =>
              onUpdate({ style: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural">Natural</SelectItem>
              <SelectItem value="vivid">Vivid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </>
  );
}

// Claude Code Node Configuration
interface ClaudeCodeNodeConfigProps {
  nodeId: string;
  data: ClaudeCodeNodeData;
  onUpdate: (data: Partial<ClaudeCodeNodeData>) => void;
}

function ClaudeCodeNodeConfig({ nodeId, data, onUpdate }: ClaudeCodeNodeConfigProps) {
  return (
    <>
      <Field label="Label">
        <Input
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Enter label..."
        />
      </Field>

      <Field
        label="Prompt"
        description="Type / to use what an earlier step made."
      >
        <PromptTextArea
          value={data.prompt || ''}
          onChange={(val) => onUpdate({ prompt: val })}
          placeholder="Create a README.md file for this project..."
          nodeId={nodeId}
          className="min-h-[150px]"
        />
      </Field>

      <Field label="Timeout (minutes)" description="Runs without asking you: its actions are approved for the run.">
        <Input
          type="number"
          min={1}
          max={60}
          value={data.timeout ?? 5}
          onChange={(e) =>
            onUpdate({ timeout: parseInt(e.target.value) || 5 })
          }
        />
      </Field>

    </>
  );
}

// Codex Node Configuration
interface CodexNodeConfigProps {
  nodeId: string;
  data: CodexNodeData;
  onUpdate: (data: Partial<CodexNodeData>) => void;
}

function CodexNodeConfig({ nodeId, data, onUpdate }: CodexNodeConfigProps) {
  const [codexModels, setCodexModels] = useState<Array<{ id: string; label: string }>>([]);

  const handleModelsMessage = useCallback((event: MessageEvent) => {
    const message = event.data;
    if (message.type === 'codex:modelsResult') {
      setCodexModels(message.models || []);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleModelsMessage);
    vscode.postMessage({ type: 'codex:getModels' });
    return () => window.removeEventListener('message', handleModelsMessage);
  }, [handleModelsMessage]);

  return (
    <>
      <Field label="Label">
        <Input
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Enter label..."
        />
      </Field>

      <Field
        label="Prompt"
        description="Type / to use what an earlier step made."
      >
        <PromptTextArea
          value={data.prompt || ''}
          onChange={(val) => onUpdate({ prompt: val })}
          placeholder="Create a README.md file for this project..."
          nodeId={nodeId}
          className="min-h-[150px]"
        />
      </Field>

      <Field
        label="Model"
        description="Select the ChatGPT model to use."
      >
        <Select
          value={getCodexModelSelectValue(data.model)}
          onValueChange={(value) =>
            onUpdate({ model: getCodexModelFromSelectValue(value) })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Default model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CODEX_DEFAULT_MODEL_SENTINEL}>Default</SelectItem>
            {codexModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Timeout (minutes)" description="Runs without asking you: its actions are approved for the run.">
        <Input
          type="number"
          min={1}
          max={60}
          value={data.timeout ?? 5}
          onChange={(e) =>
            onUpdate({ timeout: parseInt(e.target.value) || 5 })
          }
        />
      </Field>

    </>
  );
}

// Save File Node Configuration
interface SaveFileNodeConfigProps {
  nodeId: string;
  data: SaveFileNodeData;
  onUpdate: (data: Partial<SaveFileNodeData>) => void;
}

function SaveFileNodeConfig({ data, onUpdate }: SaveFileNodeConfigProps) {
  const nodes = useFlowEditorStore((state) => state.nodes);
  const otherNodes = nodes.filter((n) => n.type !== 'saveFileNode');
  const triggerNode = nodes.find((n) => n.type === 'triggerNode');
  const [showVarPicker, setShowVarPicker] = useState(false);

  // Get available variables for filename
  const availableVars = React.useMemo(() => {
    const vars: Array<{ label: string; value: string; type: string }> = [];

    // Built-in variables
    vars.push({ label: 'timestamp', value: '{timestamp}', type: 'Built-in' });
    vars.push({ label: 'date', value: '{date}', type: 'Built-in' });

    // Input variables from trigger
    if (triggerNode) {
      const triggerData = triggerNode.data as TriggerNodeData;
      for (const input of triggerData.inputs || []) {
        vars.push({ label: input.label, value: `{${input.label}}`, type: 'Input' });
      }
    }

    // Node output variables
    for (const node of otherNodes) {
      if (node.type !== 'triggerNode') {
        const label = (node.data as { label?: string }).label;
        if (label) {
          vars.push({ label, value: `{${label}}`, type: 'Node' });
        }
      }
    }

    return vars;
  }, [nodes, triggerNode, otherNodes]);

  // Listen for folder picker response
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'flow:folderPicked' && message.field === 'folder') {
        onUpdate({ folder: message.folderPath });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUpdate]);

  const insertVariable = (varValue: string) => {
    const currentFilename = data.filename || '';
    onUpdate({ filename: currentFilename + varValue });
    setShowVarPicker(false);
  };

  return (
    <>
      <Field label="Label">
        <Input
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Enter label..."
        />
      </Field>

      {/* Input first: what to save */}
      <Field label="Save output from">
        <Select
          value={data.sourceNodeId || ''}
          onValueChange={(value) => onUpdate({ sourceNodeId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select source..." />
          </SelectTrigger>
          <SelectContent>
            {otherNodes.map((node) => (
              <SelectItem key={node.id} value={node.id}>
                {(node.data as { label?: string }).label || node.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Format">
        <Select
          value={data.format || 'markdown'}
          onValueChange={(value: 'markdown' | 'csv' | 'image') =>
            onUpdate({ format: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="markdown">Markdown (.md)</SelectItem>
            <SelectItem value="csv">CSV (.csv)</SelectItem>
            <SelectItem value="image">Image (auto extension)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {/* Output: where to save */}
      <Field label="Folder" description="Relative to workspace root">
        <div className="flex gap-2">
          <Input
            value={data.folder || ''}
            onChange={(e) => onUpdate({ folder: e.target.value })}
            placeholder="output/"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => vscode.postMessage({ type: 'flow:pickFolder', field: 'folder' })}
            title="Browse folders"
          >
            <Icon name="folder-open" size={16} />
          </Button>
        </div>
      </Field>

      <Field label="Filename" description="Type / to use what an earlier step made.">
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={data.filename || ''}
              onChange={(e) => {
                const value = e.target.value;
                onUpdate({ filename: value });
                // Show picker when user types /
                if (value.endsWith('/')) {
                  setShowVarPicker(true);
                }
              }}
              placeholder="output.md"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVarPicker(!showVarPicker)}
              title="Insert variable"
            >
              <span className="text-xs font-mono">/</span>
            </Button>
          </div>

          {/* Variable picker dropdown */}
          {showVarPicker && (
            <div className="absolute z-50 mt-1 w-full bg-[var(--r-surface)] border border-[var(--r-hairline)] rounded shadow-lg max-h-48 overflow-y-auto">
              {availableVars.map((v, i) => (
                <button
                  key={i}
                  onClick={() => insertVariable(v.value)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--r-surface-soft)] flex justify-between items-center"
                >
                  <span className="text-[var(--r-ink-strong)]">{v.label}</span>
                  <span className="text-xs text-[var(--r-ink-muted)]">{v.type}</span>
                </button>
              ))}
              <button
                onClick={() => setShowVarPicker(false)}
                className="w-full px-3 py-1 text-left text-xs text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] border-t border-[var(--r-hairline)]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </Field>
    </>
  );
}
