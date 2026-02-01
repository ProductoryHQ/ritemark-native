/**
 * Input Node Component
 *
 * Represents a flow input (text or file).
 * Data from this node is collected before flow execution.
 */

import { memo } from 'react';
import { FileText, File } from 'lucide-react';
import { BaseNode, NodeField } from './BaseNode';
import type { InputNodeData } from '../stores/flowEditorStore';

interface InputNodeProps {
  data: InputNodeData;
  selected?: boolean;
}

function InputNodeComponent({ data, selected }: InputNodeProps) {
  const isFile = data.inputType === 'file';

  return (
    <BaseNode
      label={data.label}
      icon={isFile ? <File size={16} /> : <FileText size={16} />}
      selected={selected}
      showTargetHandle={false}
      headerColor="var(--vscode-inputValidation-infoBackground)"
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
