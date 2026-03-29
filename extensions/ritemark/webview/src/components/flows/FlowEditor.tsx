/**
 * Flow Editor Component
 *
 * Main component for the visual flow editor.
 * 3-column layout: NodePalette | FlowCanvas | NodeConfigPanel
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { AlertTriangle, Clock3, X } from 'lucide-react';
import { NodePalette } from './NodePalette';
import { FlowCanvas } from './FlowCanvas';
import { NodeConfigPanel } from './NodeConfigPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { FlowSettingsPanel } from './FlowSettingsPanel';
import { useFlowEditorStore } from './stores/flowEditorStore';
import type { Flow } from './stores/flowEditorStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { vscode } from '../../lib/vscode';
import { setModelConfig } from '../../config/modelConfig';
import { formatScheduleDateTime, formatScheduleSummary, getNextScheduledRun } from './flowScheduleUi';

interface FlowFeatureFlags {
  scheduledFlowRuns: boolean;
}

interface FlowScheduleStatus {
  lastRunAt: string | null;
  lastScheduledFor: string | null;
  lastStatus: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  lastError: string | null;
}

type FlowSaveState = 'idle' | 'unsaved' | 'saving' | 'saved';

export function FlowEditor() {
  const setFlow = useFlowEditorStore((state) => state.setFlow);
  const toFlow = useFlowEditorStore((state) => state.toFlow);
  const flowName = useFlowEditorStore((state) => state.flowName);
  const flowDescription = useFlowEditorStore((state) => state.flowDescription);
  const flowSchedule = useFlowEditorStore((state) => state.flowSchedule);
  const setFlowName = useFlowEditorStore((state) => state.setFlowName);
  const setFlowDescription = useFlowEditorStore(
    (state) => state.setFlowDescription
  );
  const isDirty = useFlowEditorStore((state) => state.isDirty);
  const markClean = useFlowEditorStore((state) => state.markClean);
  const validationWarnings = useFlowEditorStore(
    (state) => state.validationWarnings
  );
  const setValidationWarnings = useFlowEditorStore(
    (state) => state.setValidationWarnings
  );
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId);

  // Local state for name/description inputs to avoid aggressive autosave during typing.
  // Changes are committed to the store (triggering save) on blur or after a longer debounce.
  const [localName, setLocalName] = useState(flowName);
  const [localDescription, setLocalDescription] = useState(flowDescription);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isDescFocused, setIsDescFocused] = useState(false);

  // Sync local state when store changes externally (e.g., flow:load)
  useEffect(() => {
    if (!isNameFocused) {
      setLocalName(flowName);
    }
  }, [flowName, isNameFocused]);

  useEffect(() => {
    if (!isDescFocused) {
      setLocalDescription(flowDescription);
    }
  }, [flowDescription, isDescFocused]);

  // Debounced commit for name/description (1.5s after last keystroke)
  useEffect(() => {
    if (!isNameFocused || localName === flowName) return;
    const timer = setTimeout(() => {
      setFlowName(localName);
    }, 1500);
    return () => clearTimeout(timer);
  }, [localName, isNameFocused, flowName, setFlowName]);

  useEffect(() => {
    if (!isDescFocused || localDescription === flowDescription) return;
    const timer = setTimeout(() => {
      setFlowDescription(localDescription);
    }, 1500);
    return () => clearTimeout(timer);
  }, [localDescription, isDescFocused, flowDescription, setFlowDescription]);

  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showFlowSettings, setShowFlowSettings] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FlowFeatureFlags>({
    scheduledFlowRuns: false,
  });
  const [scheduleStatus, setScheduleStatus] = useState<FlowScheduleStatus | null>(null);
  const [saveState, setSaveState] = useState<FlowSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const savedNotificationTimerRef = useRef<number | null>(null);

  // Ref to track isRunning for message handler (avoids stale closure)
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Handle messages from VS Code extension
  useEffect(() => {
    const vscodeApi = vscode;

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'flow:load':
          setFlow(message.flow as Flow, message.workspacePath);
          setValidationWarnings(message.warnings || []);
          setError(null);
          setSaveState('idle');
          setLastSavedAt(
            message.flow?.modified ? new Date(message.flow.modified as string) : null
          );
          break;

        case 'flow:saved':
          markClean();
          setSaveState('saved');
          setLastSavedAt(new Date());
          if (savedNotificationTimerRef.current) {
            window.clearTimeout(savedNotificationTimerRef.current);
          }
          savedNotificationTimerRef.current = window.setTimeout(() => {
            setSaveState('idle');
            savedNotificationTimerRef.current = null;
          }, 2500);
          break;

        case 'flow:validation':
          setValidationWarnings(message.warnings || []);
          break;

        case 'flow:error':
          // Only handle load errors here - execution errors go to ExecutionPanel
          if (!isRunningRef.current) {
            setError(message.error);
          }
          break;

        case 'flow:modelConfig':
          // Receive model config from extension
          setModelConfig(message.config);
          break;

        case 'flow:featureFlags':
          setFeatureFlags(message.flags as FlowFeatureFlags);
          break;

        case 'flow:scheduleStatus':
          setScheduleStatus(message.status as FlowScheduleStatus);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal ready to extension
    vscodeApi.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
      if (savedNotificationTimerRef.current) {
        window.clearTimeout(savedNotificationTimerRef.current);
        savedNotificationTimerRef.current = null;
      }
    };
  }, [setFlow, markClean, setValidationWarnings]);

  useEffect(() => {
    if (isDirty) {
      setSaveState((current) => (current === 'saving' ? current : 'unsaved'));
    }
  }, [isDirty]);

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty) return;

    saveTimerRef.current = window.setTimeout(() => {
      const vscodeApi = vscode;
      const flow = toFlow();
      setSaveState('saving');
      vscodeApi.postMessage({ type: 'flow:save', flow });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [isDirty, toFlow]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const vscodeApi = vscode;
        vscodeApi.postMessage({ type: 'flow:requestSave' });
      }

      // Cmd/Ctrl + Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useFlowEditorStore.getState().undo();
      }

      // Cmd/Ctrl + Shift + Z to redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useFlowEditorStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle run flow - switch right panel to execution mode
  const handleRunFlow = useCallback(() => {
    setIsRunning(true);
  }, []);

  // Handle node selection - exit execution mode to show properties
  const handleNodeSelect = useCallback(() => {
    setShowFlowSettings(false);
    if (isRunning) {
      setIsRunning(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (!showFlowSettings) {
      return;
    }

    const refresh = () => {
      vscode.postMessage({ type: 'flow:getScheduleStatus' });
    };

    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [showFlowSettings]);

  const openFlowSettings = useCallback(() => {
    setShowFlowSettings(true);
    setIsRunning(false);
  }, []);

  const handleSaveSchedule = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveState('saving');
    vscode.postMessage({
      type: 'flow:save',
      flow: toFlow(),
    });
  }, [toFlow]);

  const nextScheduledRun = getNextScheduledRun(flowSchedule);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--vscode-editor-background)]">
        <div className="max-w-md p-6 text-center">
          <div className="text-[var(--vscode-errorForeground)] text-lg mb-2">
            Error Loading Flow
          </div>
          <div className="text-sm text-[var(--vscode-descriptionForeground)] mb-4">
            {error}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const vscodeApi = vscode;
              vscodeApi.postMessage({ type: 'ready' });
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--vscode-editor-background)]">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onFocus={() => setIsNameFocused(true)}
          onBlur={() => {
            setIsNameFocused(false);
            if (localName !== flowName) {
              setFlowName(localName);
            }
          }}
          className="max-w-[200px] font-semibold"
          placeholder="Flow name..."
        />
        <Input
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onFocus={() => setIsDescFocused(true)}
          onBlur={() => {
            setIsDescFocused(false);
            if (localDescription !== flowDescription) {
              setFlowDescription(localDescription);
            }
          }}
          className="flex-1 text-sm"
          placeholder="Description (optional)..."
        />

        {featureFlags.scheduledFlowRuns && (
          <Button
            variant="outline"
            size="sm"
            onClick={openFlowSettings}
            className="gap-2"
          >
            <Clock3 size={14} />
            <span>{formatScheduleSummary(flowSchedule)}</span>
            {flowSchedule?.enabled && (
              <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                {formatScheduleDateTime(nextScheduledRun)}
              </span>
            )}
          </Button>
        )}

        {/* Validation warnings button */}
        {validationWarnings.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWarnings(!showWarnings)}
            className="flex items-center gap-1.5 text-[var(--vscode-editorWarning-foreground)]"
          >
            <AlertTriangle size={14} />
            {validationWarnings.length} warning
            {validationWarnings.length > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Validation warnings panel */}
      {showWarnings && validationWarnings.length > 0 && (
        <div className="px-4 py-2 bg-[var(--vscode-inputValidation-warningBackground)] border-b border-[var(--vscode-inputValidation-warningBorder)]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--vscode-inputValidation-warningForeground)] mb-1">
                <AlertTriangle size={14} />
                Validation Warnings
              </div>
              <ul className="text-xs text-[var(--vscode-foreground)] space-y-0.5 ml-5">
                {validationWarnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWarnings(false)}
              className="text-[var(--vscode-foreground)]"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Main content - 3 column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Node Palette */}
        <div className="w-[220px] flex-shrink-0">
          <NodePalette />
        </div>

        {/* Center: Flow Canvas */}
        <FlowCanvas onRunFlow={handleRunFlow} onNodeSelect={handleNodeSelect} />

        {/* Right: Config Panel or Execution Panel (hidden when nothing selected) */}
        {(isRunning || selectedNodeId || showFlowSettings) && (
          <div className="w-[280px] flex-shrink-0">
            {isRunning ? (
              <ExecutionPanel
                flow={toFlow()}
                onClose={() => setIsRunning(false)}
              />
            ) : showFlowSettings ? (
              <FlowSettingsPanel
                featureEnabled={featureFlags.scheduledFlowRuns}
                runtimeStatus={scheduleStatus}
                hasUnsavedChanges={isDirty}
                saveState={saveState}
                lastSavedAt={lastSavedAt}
                onSave={handleSaveSchedule}
                onClose={() => setShowFlowSettings(false)}
              />
            ) : (
              <NodeConfigPanel />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
