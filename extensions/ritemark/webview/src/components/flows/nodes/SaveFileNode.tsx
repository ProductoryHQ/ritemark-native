/**
 * Save File Node Component
 *
 * Represents a file save operation.
 * Saves output from previous nodes to workspace.
 */

import { memo } from 'react';
import { Save } from 'lucide-react';
import { BaseNode, NodeField } from './BaseNode';
import type { SaveFileNodeData } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';

interface SaveFileNodeProps {
  id: string;
  data: SaveFileNodeData;
  selected?: boolean;
}

// Format display names
const formatNames: Record<string, string> = {
  markdown: 'Markdown (.md)',
  csv: 'CSV (.csv)',
  image: 'Image (auto)',
};

function SaveFileNodeComponent({ id, data, selected }: SaveFileNodeProps) {
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));

  return (
    <BaseNode
      label={data.label}
      icon={<Save size={16} />}
      selected={selected}
      showSourceHandle={true}
      headerColor="var(--vscode-charts-orange)"
      executionStep={executionStep}
    >
      <NodeField
        label="Filename"
        value={data.filename || 'output.md'}
      />
      <NodeField
        label="Format"
        value={formatNames[data.format] || data.format}
      />
      {data.sourceNodeId && (
        <NodeField label="Source" value={data.sourceNodeId} />
      )}
    </BaseNode>
  );
}

export const SaveFileNode = memo(SaveFileNodeComponent);
