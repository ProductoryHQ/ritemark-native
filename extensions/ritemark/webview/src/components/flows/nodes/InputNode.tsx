/**
 * Input Node Component
 *
 * Represents a flow input (text or file).
 * Data from this node is collected before flow execution.
 */

import { memo } from 'react';
import { BaseNode, NodeField } from './BaseNode';
interface InputNodeData {
  label: string;
  inputType: 'text' | 'file';
  required: boolean;
  defaultValue?: string;
}

interface InputNodeProps {
  data: InputNodeData;
  selected?: boolean;
}

function InputNodeComponent({ data, selected }: InputNodeProps) {
  const isFile = data.inputType === 'file';

  return (
    <BaseNode
      label={data.label}
      type="inputNode"
      selected={selected}
      showTargetHandle={false}
    >
      <NodeField label="Type" value={isFile ? 'File' : 'Text'} />
      <NodeField label="Required" value={data.required ? 'Yes' : 'No'} />
      {data.defaultValue && (
        <NodeField label="Default" value={data.defaultValue} />
      )}
    </BaseNode>
  );
}

export const InputNode = memo(InputNodeComponent);
