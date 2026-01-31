/**
 * Run Flow Modal
 *
 * Collects flow inputs and displays execution progress.
 */

import { useState, useEffect } from 'react';
import { X, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import type { Flow, FlowsMessage } from './types';
import { vscode } from '../../lib/vscode';

interface RunFlowModalProps {
  flow: Flow;
  onClose: () => void;
}

type ExecutionState =
  | { status: 'idle' }
  | { status: 'running'; step: number; total: number; currentNodeLabel?: string }
  | { status: 'success'; outputs: Record<string, unknown> }
  | { status: 'error'; error: string };

export function RunFlowModal({ flow, onClose }: RunFlowModalProps) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const input of flow.inputs) {
      initial[input.id] = input.defaultValue || '';
    }
    return initial;
  });

  const [state, setState] = useState<ExecutionState>({ status: 'idle' });

  useEffect(() => {
    const handleMessage = (event: MessageEvent<FlowsMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'flow:progress':
          setState({
            status: 'running',
            step: message.step,
            total: message.total,
            currentNodeLabel: message.currentNodeLabel,
          });
          break;

        case 'flow:complete':
          setState({
            status: 'success',
            outputs: message.outputs,
          });
          break;

        case 'flow:error':
          setState({
            status: 'error',
            error: message.error,
          });
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleRun = () => {
    // Validate required inputs
    for (const input of flow.inputs) {
      if (input.required && !inputs[input.id]) {
        alert(`Required input: ${input.label}`);
        return;
      }
    }

    setState({ status: 'running', step: 0, total: flow.nodes.length });

    vscode.postMessage({
      type: 'flow:run',
      id: flow.id,
      inputs,
    });
  };

  const handleCancel = () => {
    vscode.postMessage({ type: 'flow:cancel' });
    onClose();
  };

  const progress =
    state.status === 'running' ? (state.step / state.total) * 100 : 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Run Flow: {flow.name}</span>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Input Collection */}
          {state.status === 'idle' && (
            <>
              {flow.inputs.map((input) => (
                <div key={input.id} className="space-y-2">
                  <Label htmlFor={input.id}>
                    {input.label}
                    {input.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {input.type === 'text' && (
                    <Input
                      id={input.id}
                      value={inputs[input.id] || ''}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [input.id]: e.target.value,
                        }))
                      }
                      placeholder={`Enter ${input.label.toLowerCase()}...`}
                    />
                  )}
                  {input.type === 'file' && (
                    <div className="text-sm text-gray-500">
                      File picker coming in Phase 2
                    </div>
                  )}
                </div>
              ))}

              {flow.inputs.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  This flow has no inputs. Click Run to execute.
                </div>
              )}
            </>
          )}

          {/* Execution Progress */}
          {state.status === 'running' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  Running step {state.step} of {state.total}
                  {state.currentNodeLabel && `: ${state.currentNodeLabel}`}
                </span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Success State */}
          {state.status === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Flow completed successfully!</span>
              </div>

              {Object.keys(state.outputs).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                  <p className="text-xs text-gray-500 mb-2">Outputs:</p>
                  <div className="space-y-2">
                    {Object.entries(state.outputs).map(([nodeId, output]) => (
                      <div key={nodeId} className="text-xs">
                        <span className="font-mono text-gray-400">{nodeId}:</span>
                        <div className="mt-1 text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
                          {typeof output === 'string'
                            ? output.substring(0, 200) + (output.length > 200 ? '...' : '')
                            : JSON.stringify(output, null, 2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {state.status === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Flow failed</span>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {state.status === 'idle' && (
            <>
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleRun}>
                <Play className="w-4 h-4 mr-2" />
                Run Flow
              </Button>
            </>
          )}

          {state.status === 'running' && (
            <Button onClick={handleCancel} variant="destructive">
              Cancel
            </Button>
          )}

          {(state.status === 'success' || state.status === 'error') && (
            <Button onClick={onClose}>Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
