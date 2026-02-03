/**
 * Node Palette Component
 *
 * Fixed category sidebar for dragging nodes onto the canvas.
 * Categories: Start, AI, Actions.
 */

import React from 'react';
import { Sparkles, Image, Save, Zap, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NodeTemplate {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface NodeCategory {
  name: string;
  nodes: NodeTemplate[];
}

// Trigger node is the starting point - only one allowed per flow
const nodeCategories: NodeCategory[] = [
  {
    name: 'Start',
    nodes: [
      {
        type: 'triggerNode',
        label: 'Trigger',
        icon: <Zap size={18} />,
        description: 'Starting point - define flow inputs here (1 per flow)',
      },
    ],
  },
  {
    name: 'AI',
    nodes: [
      {
        type: 'llmNode',
        label: 'LLM Prompt',
        icon: <Sparkles size={18} />,
        description: 'Generate text with LLM',
      },
      {
        type: 'imageNode',
        label: 'Image Generation',
        icon: <Image size={18} />,
        description: 'Generate images with AI',
      },
      {
        type: 'claudeCodeNode',
        label: 'Claude Code',
        icon: <Bot size={18} />,
        description: 'Run autonomous coding tasks with Claude Code',
      },
    ],
  },
  {
    name: 'Actions',
    nodes: [
      {
        type: 'saveFileNode',
        label: 'Save File',
        icon: <Save size={18} />,
        description: 'Save to file and output the path for downstream nodes',
      },
    ],
  },
];

interface NodePaletteProps {
  onDragStart?: (event: React.DragEvent, nodeType: string, nodeLabel: string) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  const handleDragStart = (
    event: React.DragEvent,
    nodeType: string,
    nodeLabel: string
  ) => {
    // Store node type and label in drag data
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/nodeLabel', nodeLabel);
    event.dataTransfer.effectAllowed = 'move';

    if (onDragStart) {
      onDragStart(event, nodeType, nodeLabel);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 bg-[var(--vscode-sideBar-background)] border-r border-[var(--vscode-panel-border)]">
      <div className="text-xs font-semibold uppercase text-[var(--vscode-descriptionForeground)] mb-3">
        Nodes
      </div>

      {nodeCategories.map((category) => (
        <div key={category.name} className="mb-4">
          <div className="text-xs font-medium text-[var(--vscode-foreground)] mb-2 opacity-70">
            {category.name}
          </div>

          <div className="space-y-2">
            {category.nodes.map((node, index) => (
              <div
                key={`${node.type}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, node.type, node.label)}
                className={cn(
                  'flex items-start gap-3 p-2 rounded cursor-grab',
                  'bg-[var(--vscode-editor-background)]',
                  'border border-[var(--vscode-panel-border)]',
                  'hover:bg-[var(--vscode-list-hoverBackground)]',
                  'hover:border-[var(--vscode-focusBorder)]',
                  'transition-colors duration-150',
                  'active:cursor-grabbing'
                )}
              >
                <span className="text-[var(--vscode-foreground)] opacity-70 mt-0.5">
                  {node.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--vscode-foreground)]">
                    {node.label}
                  </div>
                  <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-0.5 line-clamp-2">
                    {node.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Help text */}
      <div className="mt-6 p-3 rounded bg-[var(--vscode-textBlockQuote-background)] border border-[var(--vscode-panel-border)]">
        <div className="text-xs text-[var(--vscode-descriptionForeground)]">
          <strong className="text-[var(--vscode-foreground)]">Tip:</strong> Drag
          nodes onto the canvas, then connect them by dragging from one handle
          to another.
        </div>
      </div>
    </div>
  );
}
