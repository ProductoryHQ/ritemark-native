/**
 * Flow Editor Component
 *
 * Main component for the visual flow editor.
 * 3-column layout: NodePalette | FlowCanvas | NodeConfigPanel
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { NodePalette } from './NodePalette';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas, useFlowAutoArrange } from './FlowCanvas';
import { NodeConfigPanel } from './NodeConfigPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { FlowSettingsPanel } from './FlowSettingsPanel';
import { useFlowEditorStore } from './stores/flowEditorStore';
import type { Flow } from './stores/flowEditorStore';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { vscode } from '../../lib/vscode';
import { setModelConfig } from '../../config/modelConfig';
import { formatScheduleDateTime, formatScheduleSummary, getNextScheduledRun } from './flowScheduleUi';

/** A quiet button in the desk's bar (kit: .btn.quiet). */
/** the desk bar's quiet buttons (kit: .fbar .btn.ghost) */
const BAR_QUIET = 'h-7 gap-1.5 px-2 text-[13px] text-[var(--r-ink-body)]';

function AutoArrangeButton() {
  const autoArrange = useFlowAutoArrange();
  return (
    <Tooltip label="Lay the steps out in order">
      <Button type="button" variant="toolbar" onClick={() => void autoArrange()} className={BAR_QUIET}>
        <Icon name="squares-four" size={14} tone="inherit" />
        Auto-arrange
      </Button>
    </Tooltip>
  );
}

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
  // Sprint 145 R4: the flow last sent to be written. A `flow:saved` while the flow differs from it (an edit came during
  // the write) keeps the flow dirty and writes again; the next look no longer does that by accident.
  const sentFlowRef = useRef<string | null>(null);

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

        case 'flow:saved': {
          const current = useFlowEditorStore.getState().toFlow();
          if (sentFlowRef.current !== null && JSON.stringify(current) !== sentFlowRef.current) {
            // Sprint 145 R4: the host wrote an older copy; write the newer one after the usual pause
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = window.setTimeout(() => {
              saveTimerRef.current = null;
              const flow = useFlowEditorStore.getState().toFlow();
              sentFlowRef.current = JSON.stringify(flow);
              vscodeApi.postMessage({ type: 'flow:save', flow });
            }, 500);
            break;
          }
          sentFlowRef.current = null;
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
        }

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
      sentFlowRef.current = JSON.stringify(flow);
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
        // Sprint 145 R4: an edit the autosave hasn't sent yet goes with the save, so the save holds it
        const store = useFlowEditorStore.getState();
        let flow: Flow | undefined;
        if (store.isDirty) {
          if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          flow = store.toFlow();
          sentFlowRef.current = JSON.stringify(flow);
        }
        vscodeApi.postMessage({ type: 'flow:requestSave', flow });
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
    const flow = toFlow();
    sentFlowRef.current = JSON.stringify(flow);
    vscode.postMessage({ type: 'flow:save', flow });
  }, [toFlow]);

  const nextScheduledRun = getNextScheduledRun(flowSchedule);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--vscode-editor-background)]">
        <div className="max-w-md p-6 text-center">
          <div className="text-[var(--r-error)] text-lg mb-2">
            Couldn't open this flow
          </div>
          <div className="text-sm text-[var(--r-ink-muted)] mb-4">
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
    <ReactFlowProvider>
    <div className="flex h-full flex-col bg-[var(--r-surface)]">
      {/* Ritemark 2.0 (experience 31; kit: theme.html .fbar): the header is the desk's bar, like every document's:
          the name, the description in muted ink, the schedule, then Auto-arrange and Run flow */}
      <div className="relative h-[52px] flex-none">
        <div className="absolute inset-x-1 top-1 flex h-8 items-center gap-1">
          <input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onFocus={() => setIsNameFocused(true)}
            onBlur={() => {
              setIsNameFocused(false);
              if (localName !== flowName) {
                setFlowName(localName);
              }
            }}
            aria-label="Flow name"
            placeholder="Flow name..."
            size={Math.max(8, localName.length)}
            className="ml-3 min-w-0 max-w-[260px] rounded bg-transparent text-[13px] font-semibold leading-7 text-[var(--r-ink-strong)] outline-none placeholder:text-[var(--r-ink-muted)] focus:shadow-[inset_0_-1px_0_var(--r-accent)]"
          />
          <input
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onFocus={() => setIsDescFocused(true)}
            onBlur={() => {
              setIsDescFocused(false);
              if (localDescription !== flowDescription) {
                setFlowDescription(localDescription);
              }
            }}
            aria-label="Description"
            placeholder="Description (optional)..."
            className="ml-2 min-w-0 flex-1 truncate rounded bg-transparent text-[13px] leading-7 text-[var(--r-ink-muted)] outline-none placeholder:text-[var(--r-ink-faint)] focus:shadow-[inset_0_-1px_0_var(--r-accent)]"
          />

          {featureFlags.scheduledFlowRuns && (
            <Tooltip label={flowSchedule ? 'Change when this flow runs on its own' : 'Run this flow on a schedule'}>
              <Button
                type="button"
                variant="toolbar"
                onClick={openFlowSettings}
                data-state={showFlowSettings ? 'active' : undefined}
                className="h-7 gap-1.5 px-2.5 text-[12px]"
              >
                <Icon name="clock" size={14} className="text-[var(--r-ink-body)]" tone="inherit" />
                <span>{formatScheduleSummary(flowSchedule)}</span>
                {flowSchedule?.enabled && (
                  <span className="font-normal text-[var(--r-ink-muted)]">
                    · next {formatScheduleDateTime(nextScheduledRun)}
                  </span>
                )}
              </Button>
            </Tooltip>
          )}

          {/* Validation warnings button */}
          {validationWarnings.length > 0 && (
            <Tooltip label={showWarnings ? 'Hide the steps to check' : 'Show the steps to check'}>
              <Button
                type="button"
                variant="toolbar"
                onClick={() => setShowWarnings(!showWarnings)}
                data-state={showWarnings ? 'active' : undefined}
                className={BAR_QUIET + ' text-[var(--vscode-editorWarning-foreground)] hover:text-[var(--vscode-editorWarning-foreground)] data-[state=active]:text-[var(--vscode-editorWarning-foreground)]'}
              >
                <Icon name="warning" size={14} tone="inherit" />
                {validationWarnings.length} warning
                {validationWarnings.length > 1 ? 's' : ''}
              </Button>
            </Tooltip>
          )}

          <AutoArrangeButton />
          <Tooltip label="Run this flow now">
            <Button type="button" onClick={handleRunFlow} className="h-7 gap-1.5 px-2.5 text-[13px] has-[>svg]:px-2.5">
              <Icon name="play" size={14} tone="inherit" />
              Run flow
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Validation warnings panel */}
      {showWarnings && validationWarnings.length > 0 && (
        <div className="px-4 py-2 bg-[var(--vscode-inputValidation-warningBackground)] border-b border-[var(--vscode-inputValidation-warningBorder)]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--vscode-inputValidation-warningForeground)] mb-1">
                <Icon name="warning" size={14} />
                Check these steps
              </div>
              <ul className="text-xs text-[var(--r-ink-strong)] space-y-0.5 ml-5">
                {validationWarnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWarnings(false)}
              className="text-[var(--r-ink-strong)]"
            >
              <Icon name="x" size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Main content - 3 column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: the steps (176, kit: .palette) */}
        <div className="w-[176px] flex-shrink-0">
          <NodePalette />
        </div>

        {/* Center: Flow Canvas */}
        <FlowCanvas onNodeSelect={handleNodeSelect} />

        {/* Right: the chosen step's settings, a run, or the flow's schedule (248, kit: .props) */}
        {(isRunning || selectedNodeId || showFlowSettings) && (
          <div className="rm-flow-props w-[248px] flex-shrink-0 border-t border-[var(--r-hairline)]">
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
    </ReactFlowProvider>
  );
}
