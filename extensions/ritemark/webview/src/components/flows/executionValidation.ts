import type { Flow } from './stores/flowEditorStore';

export function validateFlowForExecution(flow: Flow): string[] {
  const errors: string[] = [];

  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push('Flow has no nodes');
  } else if (flow.nodes.length === 1 && flow.nodes[0].type === 'trigger') {
    errors.push('Flow only has a Trigger node - add more nodes to process');
  }

  const hasExecutableNode = flow.nodes.some((node) => node.type !== 'trigger');
  if (!hasExecutableNode && flow.nodes.length > 0) {
    errors.push('Flow needs at least one node after Trigger');
  }

  return errors;
}
