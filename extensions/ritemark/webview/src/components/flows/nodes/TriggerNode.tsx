/**
 * Trigger Node Component
 *
 * The starting point of every flow.
 * Contains all flow-level inputs that users fill when running.
 * Only ONE Trigger node per flow.
 */

import { memo } from 'react';
import { BaseNode, NodeField } from './BaseNode';
import type { FlowInput } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';

export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  inputs: FlowInput[];
}

interface TriggerNodeProps {
  id: string;
  data: TriggerNodeData;
  selected?: boolean;
}

function TriggerNodeComponent({ id, data, selected }: TriggerNodeProps) {
  const inputs = data.inputs || [];
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));

  // Ritemark 2.0 (experience 31): the trigger is a step like the others, its inputs in one row
  return (
    <BaseNode
      type="triggerNode"
      label={data.label || 'Trigger'}
      selected={selected}
      showTargetHandle={false}
      executionStep={executionStep}
    >
      <NodeField
        label="Inputs"
        value={inputs.length === 0 ? 'none' : inputs.map((input) => input.label + (input.required ? ' *' : '')).join(', ')}
      />
    </BaseNode>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
