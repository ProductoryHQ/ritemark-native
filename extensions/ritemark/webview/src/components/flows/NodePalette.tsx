/**
 * Node Palette Component
 *
 * Fixed category sidebar for dragging steps onto the canvas.
 * Categories: Start, AI, Actions (stepKinds.ts).
 */

import React from 'react';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';
import { STEP_CATEGORIES, STEPS } from './stepKinds';

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

  // Ritemark 2.0 (experience 31; kit: theme.html .palette): the steps as the column's rows, under their groups
  return (
    <div className="h-full overflow-y-auto border-t border-[var(--r-hairline)] px-2 py-1">
      {STEP_CATEGORIES.map((category) => (
        <div key={category.name}>
          <div className="mx-2 mb-1 mt-3 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.5px] text-[var(--r-ink-muted)]">
            {category.name}
          </div>
          {STEPS.filter((step) => step.kind === category.kind && step.type !== 'inputNode').map((step) => (
            <Tooltip key={step.type} label={`${step.description} Drag it onto the canvas.`} side="right" className="flex w-full">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, step.type, step.name)}
                className="flex h-8 w-full cursor-grab items-center gap-2 whitespace-nowrap rounded-md px-2 text-[13px] text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)] active:cursor-grabbing"
              >
                <Icon name={step.icon} size={14} />
                {step.name}
              </div>
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  );
}
