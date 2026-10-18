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
  { type: 'triggerNode', name: 'Trigger', icon: 'lightning', kind: 'start', description: 'Where the flow starts, with the inputs it asks for. A flow has one.' },
  { type: 'llmNode', name: 'LLM prompt', icon: 'chat-text', kind: 'ai', description: 'Writes text with a language model.' },
  { type: 'imageNode', name: 'Image generation', icon: 'image', kind: 'ai', description: 'Makes an image with AI.' },
  { type: 'claudeCodeNode', name: 'Claude Code', icon: 'robot', kind: 'ai', description: 'Gives a task to Claude Code, which can read and change the project\'s files.' },
  { type: 'codexNode', name: 'Codex', icon: 'code', kind: 'ai', description: 'Gives a task to Codex, which can read and change the project\'s files.' },
  { type: 'saveFileNode', name: 'Save file', icon: 'floppy-disk', kind: 'action', description: 'Saves what an earlier step made to a file in the project.' },
  { type: 'inputNode', name: 'Input', icon: 'file-text', kind: 'start', description: 'A flow input.' },
];

export const STEP_CATEGORIES: readonly { readonly name: string; readonly kind: StepKind }[] = [
  { name: 'Start', kind: 'start' },
  { name: 'AI', kind: 'ai' },
  { name: 'Actions', kind: 'action' },
];

export function stepInfo(type: string | undefined): StepInfo | undefined {
  return STEPS.find(step => step.type === type);
}
