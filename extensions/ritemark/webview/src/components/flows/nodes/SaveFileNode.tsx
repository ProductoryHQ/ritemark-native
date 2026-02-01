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

interface SaveFileNodeProps {
  data: SaveFileNodeData;
  selected?: boolean;
}

// Format display names
const formatNames: Record<string, string> = {
  markdown: 'Markdown (.md)',
  csv: 'CSV (.csv)',
  image: 'Image (auto)',
};

function SaveFileNodeComponent({ data, selected }: SaveFileNodeProps) {
  return (
    <BaseNode
      label={data.label}
      icon={<Save size={16} />}
      selected={selected}
      showSourceHandle={false}
      headerColor="var(--vscode-charts-orange)"
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
