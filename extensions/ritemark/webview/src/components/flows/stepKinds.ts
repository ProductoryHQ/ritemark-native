/**
 * A flow's kinds of step (Ritemark 2.0, experience 31): the palette, the canvas and the settings column name and draw
 * a step the same way. Each kind keeps one colour in both themes (index.css, .rm-step-chip).
 */
import type { PhosphorIconName } from '../ui/Icon';

export type StepKind = 'start' | 'ai' | 'action';

export interface StepInfo {
  readonly type: string;
  readonly name: string;
  readonly icon: PhosphorIconName;
  readonly kind: StepKind;
  readonly description: string;
}

export const STEPS: readonly StepInfo[] = [
  { type: 'triggerNode', name: 'Trigger', icon: 'lightning', kind: 'start', description: 'Starting point - define flow inputs here (1 per flow)' },
  { type: 'llmNode', name: 'LLM prompt', icon: 'chat-text', kind: 'ai', description: 'Generate text with LLM' },
  { type: 'imageNode', name: 'Image generation', icon: 'image', kind: 'ai', description: 'Generate images with AI' },
  { type: 'claudeCodeNode', name: 'Claude Code', icon: 'robot', kind: 'ai', description: 'Run autonomous coding tasks with Claude Code' },
  { type: 'codexNode', name: 'Codex', icon: 'code', kind: 'ai', description: 'Run autonomous coding tasks with OpenAI Codex' },
  { type: 'saveFileNode', name: 'Save file', icon: 'floppy-disk', kind: 'action', description: 'Save to file and output the path for downstream nodes' },
  { type: 'inputNode', name: 'Input', icon: 'file-text', kind: 'start', description: 'A flow input' },
];

export const STEP_CATEGORIES: readonly { readonly name: string; readonly kind: StepKind }[] = [
  { name: 'Start', kind: 'start' },
  { name: 'AI', kind: 'ai' },
  { name: 'Actions', kind: 'action' },
];

export function stepInfo(type: string | undefined): StepInfo | undefined {
  return STEPS.find(step => step.type === type);
}
