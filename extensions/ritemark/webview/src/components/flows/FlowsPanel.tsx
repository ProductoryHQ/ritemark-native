/**
 * Flows Panel
 *
 * Main sidebar panel for listing and managing flows.
 */

import { useState, useEffect } from 'react';
import { Play, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { RunFlowModal } from './RunFlowModal';
import type { Flow, FlowsMessage, FlowsCommand } from './types';

declare const acquireVsCodeApi: () => {
  postMessage: (message: FlowsCommand) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

const vscode = acquireVsCodeApi();

export function FlowsPanel() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);

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

  const handleRunFlow = (flow: Flow) => {
    setSelectedFlow(flow);
    setShowRunModal(true);
  };

  const handleDeleteFlow = async (flow: Flow) => {
    // Confirm deletion
    if (!confirm(`Delete flow "${flow.name}"?`)) {
      return;
    }

    vscode.postMessage({
      type: 'flow:delete',
      id: flow.id,
    });
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
            Visual flow editor coming in Phase 2
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          Refresh
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
              className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{flow.name}</h3>
                  {flow.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {flow.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={() => handleRunFlow(flow)}
                  size="sm"
                  className="flex-1"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Run
                </Button>
                <Button
                  onClick={() => handleDeleteFlow(flow)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div className="text-xs text-gray-400 mt-2">
                Modified: {new Date(flow.modified).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showRunModal && selectedFlow && (
        <RunFlowModal
          flow={selectedFlow}
          onClose={() => {
            setShowRunModal(false);
            setSelectedFlow(null);
          }}
        />
      )}
    </div>
  );
}
