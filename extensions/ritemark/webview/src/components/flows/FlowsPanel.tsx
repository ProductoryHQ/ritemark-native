/**
 * Flows Panel
 *
 * Main sidebar panel for listing and managing flows.
 * UX: Click item to open in editor, Edit/Delete on hover.
 * Running flows happens in the flow editor, not sidebar.
 */

import { useState, useEffect } from 'react';
import { Trash2, Pencil, Loader2, AlertCircle, Plus, Clock3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import type { Flow, FlowsMessage } from './types';
import { vscode } from '../../lib/vscode';
import { formatScheduleDateTime, formatScheduleSummary } from './flowScheduleUi';

export function FlowsPanel() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle messages from extension
    const handleMessage = (event: MessageEvent<FlowsMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'flow:list':
          setFlows(message.flows);
          setLoading(false);
          break;

        case 'flow:deleted':
          setFlows((prev) => prev.filter((f) => f.id !== message.id));
          break;

        case 'flow:error':
          setError(message.error);
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial flow list
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleOpenFlow = (flow: Flow) => {
    vscode.postMessage({
      type: 'flow:open',
      id: flow.id,
    });
  };

  const handleDeleteFlow = (flow: Flow, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger open
    // Use VS Code's native confirmation dialog (confirm() doesn't work in webviews)
    vscode.postMessage({
      type: 'flow:delete-confirm',
      id: flow.id,
      name: flow.name,
    });
  };

  const handleNewFlow = () => {
    vscode.postMessage({ type: 'flow:new' });
  };

  const handleRefresh = () => {
    setLoading(true);
    vscode.postMessage({ type: 'flow:list' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={handleRefresh}
          className="mt-4 w-full"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-gray-500 mb-4">
          <p className="text-sm mb-2">No flows yet</p>
          <p className="text-xs text-gray-400">
            Create your first automation workflow
          </p>
        </div>
        <Button onClick={handleNewFlow} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Flow
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
          {flows.map((flow) => (
            <div
              key={flow.id}
              onClick={() => handleOpenFlow(flow)}
              className="group border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              {/* Header with title and hover actions */}
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-sm truncate flex-1 min-w-0">
                  {flow.name}
                </h3>
                {/* Hover-revealed actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFlow(flow);
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    title="Edit flow"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={(e) => handleDeleteFlow(flow, e)}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:text-red-500"
                    title="Delete flow"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Description */}
              {flow.description && (
                <p className="text-xs text-gray-500 line-clamp-2">
                  {flow.description}
                </p>
              )}

              {flow.schedule && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock3 className="w-3 h-3" />
                    <span>{formatScheduleSummary(flow.schedule)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400 truncate">
                      Next: {formatScheduleDateTime(flow.nextScheduledRun ? new Date(flow.nextScheduledRun) : null)}
                    </span>
                    <span className="text-[11px] rounded-full px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 text-gray-500">
                      {flow.scheduleRuntime?.lastStatus ?? 'idle'}
                    </span>
                  </div>
                  {flow.scheduleRuntime?.lastError && (
                    <p className="text-[11px] text-red-500 line-clamp-2">
                      {flow.scheduleRuntime.lastError}
                    </p>
                  )}
                </div>
              )}

              {/* Modified date */}
              <div className="text-xs text-gray-400 mt-2">
                Modified: {new Date(flow.modified).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
