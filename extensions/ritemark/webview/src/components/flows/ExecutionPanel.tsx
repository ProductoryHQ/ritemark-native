/**
 * Execution Panel
 *
 * Shows flow execution progress in the right sidebar.
 * Displays: input collection → step progress → results
 */

import { useState, useEffect } from 'react';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  X,
  Sparkles,
  FileText,
  Image,
  Save,
  Zap,
  AlertTriangle,
  FolderOpen,
  Terminal,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { Flow, FlowInput } from './stores/flowEditorStore';
import { vscode } from '../../lib/vscode';

interface ExecutionStep {
  nodeId: string;
  label: string;
  type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code' | 'codex';
  status: 'pending' | 'running' | 'complete' | 'error';
  output?: string;
  error?: string;
  /** Autonomous coding node progress messages */
  progress?: Array<{ type: string; message: string; tool?: string }>;
}

interface ExecutionPanelProps {
  flow: Flow;
  onClose: () => void;
}

// Node type icons
const nodeIcons: Record<string, typeof Sparkles> = {
  'trigger': Zap,
  'llm-prompt': Sparkles,
  'image-prompt': Image,
  'save-file': Save,
  'claude-code': Terminal,
  'codex': Terminal,
};

// Validate flow can run
function validateFlow(flow: Flow): string[] {
  const errors: string[] = [];

  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push('Flow has no nodes');
  } else if (flow.nodes.length === 1 && flow.nodes[0].type === 'trigger') {
    errors.push('Flow only has a Trigger node - add more nodes to process');
  }

  // Check if there's at least one processing node (LLM, Image, Claude Code, or Save)
  const hasProcessingNode = flow.nodes.some(
    (n) => n.type === 'llm-prompt' || n.type === 'image-prompt' || n.type === 'save-file' || n.type === 'claude-code' || n.type === 'codex'
  );
  if (!hasProcessingNode && flow.nodes.length > 0) {
    errors.push('Flow needs at least one AI or Output node');
  }

  return errors;
}

export function ExecutionPanel({ flow, onClose }: ExecutionPanelProps) {
  const [phase, setPhase] = useState<'input' | 'running' | 'complete' | 'error'>('input');
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const input of flow.inputs) {
      initial[input.id] = input.defaultValue || '';
    }
    return initial;
  });
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validate flow
  const validationErrors = validateFlow(flow);
  const canRun = validationErrors.length === 0;

  // Initialize steps from flow nodes (Trigger first, then topological order)
  useEffect(() => {
    // Sort: Trigger first, then by execution order (topological sort)
    const sortedNodes = [...flow.nodes].sort((a, b) => {
      // Trigger always first
      if (a.type === 'trigger') return -1;
      if (b.type === 'trigger') return 1;

      // For other nodes, use topological order based on edges
      const aIsUpstream = flow.edges.some(e => e.source === a.id && e.target === b.id);
      const bIsUpstream = flow.edges.some(e => e.source === b.id && e.target === a.id);
      if (aIsUpstream) return -1;
      if (bIsUpstream) return 1;
      return 0;
    });

    const executionSteps: ExecutionStep[] = sortedNodes.map((node) => ({
      nodeId: node.id,
      label: (node.data as { label?: string }).label || node.id,
      type: node.type,
      status: 'pending',
    }));
    setSteps(executionSteps);
  }, [flow.nodes, flow.edges]);

  // Listen for execution messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'flow:stepStart':
          setSteps((prev) =>
            prev.map((step) =>
              step.nodeId === message.nodeId
                ? { ...step, status: 'running' }
                : step
            )
          );
          break;

        case 'flow:stepComplete':
          setSteps((prev) =>
            prev.map((step) =>
              step.nodeId === message.nodeId
                ? { ...step, status: 'complete', output: message.output }
                : step
            )
          );
          break;

        case 'flow:stepError':
          setSteps((prev) =>
            prev.map((step) =>
              step.nodeId === message.nodeId
                ? { ...step, status: 'error', error: message.error }
                : step
            )
          );
          break;

        case 'flow:complete':
          setPhase('complete');
          break;

        case 'flow:error':
          setPhase('error');
          setErrorMessage(message.error);
          break;

        case 'flow:filePicked':
          // File picker response - update the input value
          if (message.inputId && message.filePath) {
            setInputs((prev) => ({ ...prev, [message.inputId]: message.filePath }));
          }
          break;

        case 'flow:claudeCodeProgress':
        case 'flow:codexProgress':
          // Autonomous coding node progress update - add to step's progress array
          setSteps((prev) =>
            prev.map((step) =>
              step.nodeId === message.nodeId
                ? {
                    ...step,
                    progress: [
                      ...(step.progress || []),
                      message.progress,
                    ].slice(-10), // Keep last 10 messages
                  }
                : step
            )
          );
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRun = () => {
    // Validate required inputs
    for (const input of flow.inputs) {
      if (input.required && !inputs[input.id]?.trim()) {
        alert(`Required: ${input.label}`);
        return;
      }
    }

    setPhase('running');

    // Reset steps to pending (clear all previous output, errors, and progress)
    setSteps((prev) => prev.map((step) => ({ ...step, status: 'pending', output: undefined, error: undefined, progress: undefined })));

    vscode.postMessage({
      type: 'flow:run',
      id: flow.id,
      inputs,
    });
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-[var(--vscode-descriptionForeground)]" />;
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-[var(--vscode-progressBar-foreground)]" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-[var(--vscode-testing-iconPassed)]" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-[var(--vscode-testing-iconFailed)]" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--vscode-sideBar-background)] border-l border-[var(--vscode-panel-border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[var(--vscode-foreground)]">
            {phase === 'input' ? 'Run Flow' : 'Results'}
          </span>
          {phase === 'complete' && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--vscode-testing-iconPassed)]/20 text-[var(--vscode-testing-iconPassed)] border border-[var(--vscode-testing-iconPassed)]/30">
              Workflow Finished
            </span>
          )}
          {phase === 'error' && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--vscode-testing-iconFailed)]/20 text-[var(--vscode-testing-iconFailed)] border border-[var(--vscode-testing-iconFailed)]/30">
              Failed
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Input Collection Phase */}
        {phase === 'input' && (
          <div className="space-y-4">
            {/* Validation Errors */}
            {!canRun && (
              <div className="p-3 rounded bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)]">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--vscode-errorForeground)] mb-2">
                  <AlertTriangle size={16} />
                  Cannot Run Flow
                </div>
                <ul className="text-xs text-[var(--vscode-errorForeground)] space-y-1 ml-6">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {canRun && flow.inputs.length > 0 ? (
              <>
                <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                  Enter the required inputs to run this flow.
                </p>
                {flow.inputs.map((input) => (
                  <div key={input.id} className="space-y-1.5">
                    <Label htmlFor={input.id} className="text-xs">
                      {input.label}
                      {input.required && <span className="text-[var(--vscode-errorForeground)] ml-1">*</span>}
                    </Label>
                    {input.type === 'file' ? (
                      <div className="flex gap-2">
                        <Input
                          id={input.id}
                          value={inputs[input.id] || ''}
                          onChange={(e) =>
                            setInputs((prev) => ({ ...prev, [input.id]: e.target.value }))
                          }
                          placeholder="Select a file..."
                          className="text-sm flex-1"
                          readOnly
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            vscode.postMessage({
                              type: 'flow:pickFile',
                              inputId: input.id,
                              label: input.label,
                            });
                          }}
                          className="px-3"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id={input.id}
                        value={inputs[input.id] || ''}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [input.id]: e.target.value }))
                        }
                        placeholder={`Enter ${input.label.toLowerCase()}...`}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </>
            ) : canRun ? (
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                This flow has no inputs. Click Run to execute.
              </p>
            ) : null}

            {canRun && (
              <Button onClick={handleRun} className="w-full mt-4">
                <Play className="w-4 h-4 mr-2" />
                Run Flow
              </Button>
            )}
          </div>
        )}

        {/* Running/Complete Phase - Step List */}
        {(phase === 'running' || phase === 'complete' || phase === 'error') && (
          <div className="space-y-1">
            {steps.map((step) => {
              const Icon = nodeIcons[step.type] || Sparkles;
              const isExpanded = expandedSteps.has(step.nodeId);
              const hasContent = step.output || step.error;

              return (
                <div key={step.nodeId}>
                  <button
                    onClick={() => hasContent && toggleExpand(step.nodeId)}
                    disabled={!hasContent}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-left transition-colors ${
                      hasContent
                        ? 'hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    {getStatusIcon(step.status)}
                    <Icon className="w-4 h-4 text-[var(--vscode-descriptionForeground)]" />
                    <span className="flex-1 text-sm text-[var(--vscode-foreground)] truncate">
                      {step.label}
                    </span>
                    {hasContent && (
                      isExpanded
                        ? <ChevronDown className="w-4 h-4 text-[var(--vscode-descriptionForeground)]" />
                        : <ChevronRight className="w-4 h-4 text-[var(--vscode-descriptionForeground)]" />
                    )}
                  </button>

                  {/* Claude Code Live Progress */}
                  {step.type === 'claude-code' && step.status === 'running' && step.progress && step.progress.length > 0 && (
                    <div className="ml-10 mr-2 mb-2 p-2 rounded bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {step.progress.map((p, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {p.type === 'init' && <Terminal className="w-3 h-3 mt-0.5 text-[var(--vscode-terminal-ansiBlue)]" />}
                            {p.type === 'tool_use' && <Zap className="w-3 h-3 mt-0.5 text-[var(--vscode-terminal-ansiYellow)]" />}
                            {p.type === 'thinking' && <Sparkles className="w-3 h-3 mt-0.5 text-[var(--vscode-terminal-ansiMagenta)]" />}
                            {p.type === 'done' && <CheckCircle className="w-3 h-3 mt-0.5 text-[var(--vscode-testing-iconPassed)]" />}
                            <span className="text-[var(--vscode-descriptionForeground)] leading-tight">{p.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded Content */}
                  {isExpanded && hasContent && (
                    <div className="ml-10 mr-2 mb-2 p-3 rounded bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
                      {step.error ? (
                        <p className="text-xs text-[var(--vscode-errorForeground)] whitespace-pre-wrap">
                          {step.error}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--vscode-foreground)] whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {typeof step.output === 'string'
                            ? step.output.substring(0, 500) + (step.output.length > 500 ? '...' : '')
                            : JSON.stringify(step.output, null, 2)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Error Message */}
            {phase === 'error' && errorMessage && (
              <div className="mt-4 p-3 rounded bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)]">
                <p className="text-xs text-[var(--vscode-errorForeground)]">{errorMessage}</p>
              </div>
            )}

            {/* Run Again Button */}
            {(phase === 'complete' || phase === 'error') && (
              <Button
                onClick={() => setPhase('input')}
                variant="secondary"
                className="w-full mt-4"
              >
                Run Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
